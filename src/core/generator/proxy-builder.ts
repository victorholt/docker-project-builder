import type { IFileWriter } from '../interfaces/file-writer.js';
import type { ITemplateRenderer } from '../interfaces/template-renderer.js';
import type { IServicePlugin, ProxyRoute } from '../interfaces/service-plugin.js';
import type { ProjectConfig } from '../models/project-config.js';
import { join } from 'path';

/**
 * ProxyBuilder generates proxy configuration files (Apache vhosts, Nginx conf, etc.)
 */
export class ProxyBuilder {
  constructor(
    private fileWriter: IFileWriter,
    private templateRenderer: ITemplateRenderer
  ) {}

  /**
   * Builds proxy configuration files
   */
  async buildProxyConfig(config: ProjectConfig, plugins: IServicePlugin[]): Promise<void> {
    const { outputPath } = config;
    const proxyDir = join(outputPath, 'docker/proxy');

    // Collect all proxy routes from plugins
    const routes: ProxyRoute[] = [];
    for (const plugin of plugins) {
      const pluginRoutes = plugin.getProxyRoutes(config);
      routes.push(...pluginRoutes);
    }

    // Generate Apache vhost configurations
    await this.buildApacheVhosts(proxyDir, config, routes);

    // Generate main Apache config (httpd.conf)
    await this.buildApacheMainConfig(proxyDir, config);
  }

  /**
   * Builds Apache vhost configuration files
   */
  private async buildApacheVhosts(
    proxyDir: string,
    config: ProjectConfig,
    routes: ProxyRoute[]
  ): Promise<void> {
    // Base vhosts (path-based routing)
    await this.buildPathBasedVhosts(proxyDir, config, routes, 'httpd-vhosts.conf');

    // Dev vhosts (subdomain routing for .test domain)
    await this.buildSubdomainVhosts(proxyDir, config, routes, 'httpd-vhosts-dev.conf');

    // Prod vhosts (subdomain routing for production domain)
    if (config.environments.includes('prod')) {
      await this.buildSubdomainVhosts(proxyDir, config, routes, 'httpd-vhosts-prod.conf', true);
    }
  }

  /**
   * Builds path-based vhost configuration
   */
  private async buildPathBasedVhosts(
    proxyDir: string,
    config: ProjectConfig,
    routes: ProxyRoute[],
    fileName: string
  ): Promise<void> {
    const lines: string[] = [
      '<VirtualHost *:80>',
      `    ServerName ${config.domain}`,
      `    ServerAdmin admin@${config.domain}`,
      '',
      '    # Error and access logs (Docker-friendly: stdout/stderr)',
      '    ErrorLog /proc/self/fd/2',
      '    CustomLog /proc/self/fd/1 combined',
      '',
      '    # ACME challenge directory (for Let\'s Encrypt HTTP-01 validation)',
      '    Alias /.well-known/acme-challenge/ /usr/local/apache2/htdocs/.well-known/acme-challenge/',
      '    <Directory "/usr/local/apache2/htdocs/.well-known/acme-challenge/">',
      '        Options None',
      '        AllowOverride None',
      '        Require all granted',
      '    </Directory>',
      '',
      '    # Redirect to HTTPS when certificates are present',
      `    <IfFile "/usr/local/apache2/conf/ssl/${config.domain}.crt">`,
      '        RewriteEngine On',
      '        RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/',
      '        RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]',
      '    </IfFile>',
      '',
    ];

    // Sort routes: more specific paths first (longer paths before shorter)
    const sortedRoutes = [...routes].sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0));

    // Add ProxyPass rules for each route (used when no SSL certs exist)
    for (const route of sortedRoutes) {
      if (route.path) {
        lines.push(`    # ${route.serviceName}`);
        const proxyPath = route.path === '/' ? route.path : `${route.path}/`;
        lines.push(`    ProxyPass ${proxyPath} http://${route.serviceName}:${route.port}${proxyPath}`);
        lines.push(`    ProxyPassReverse ${proxyPath} http://${route.serviceName}:${route.port}${proxyPath}`);
        lines.push('');
      }
    }

    lines.push('</VirtualHost>');
    lines.push('');

    // Add SSL VirtualHost (activated when certs exist)
    lines.push(`# SSL VirtualHost (activated when certificates are generated via ./cli certs)`);
    lines.push(`<IfFile "/usr/local/apache2/conf/ssl/${config.domain}.crt">`);
    lines.push('<VirtualHost *:443>');
    lines.push(`    ServerName ${config.domain}`);
    lines.push(`    ServerAdmin admin@${config.domain}`);
    lines.push('');
    lines.push('    SSLEngine on');
    lines.push(`    SSLCertificateFile /usr/local/apache2/conf/ssl/${config.domain}.crt`);
    lines.push(`    SSLCertificateKeyFile /usr/local/apache2/conf/ssl/${config.domain}.key`);
    lines.push('    SSLCACertificateFile /usr/local/apache2/conf/ssl/ca.crt');
    lines.push('');
    lines.push('    # Error and access logs (Docker-friendly: stdout/stderr)');
    lines.push('    ErrorLog /proc/self/fd/2');
    lines.push('    CustomLog /proc/self/fd/1 combined');
    lines.push('');

    for (const route of sortedRoutes) {
      if (route.path) {
        lines.push(`    # ${route.serviceName}`);
        const sslProxyPath = route.path === '/' ? route.path : `${route.path}/`;
        lines.push(`    ProxyPass ${sslProxyPath} http://${route.serviceName}:${route.port}${sslProxyPath}`);
        lines.push(`    ProxyPassReverse ${sslProxyPath} http://${route.serviceName}:${route.port}${sslProxyPath}`);
        lines.push('');
      }
    }

    lines.push('</VirtualHost>');
    lines.push('</IfFile>');

    const content = lines.join('\n') + '\n';
    const filePath = join(proxyDir, fileName);
    await this.fileWriter.writeFile(filePath, content);
  }

  /**
   * Builds subdomain-based vhost configuration
   */
  private async buildSubdomainVhosts(
    proxyDir: string,
    config: ProjectConfig,
    routes: ProxyRoute[],
    fileName: string,
    isProd: boolean = false
  ): Promise<void> {
    const lines: string[] = [];

    // Create a VirtualHost for each route with subdomain
    for (const route of routes) {
      if (route.subdomain) {
        const serverName = `${route.subdomain}.${config.domain}`;

        // HTTP VirtualHost
        lines.push('<VirtualHost *:80>');
        lines.push(`    ServerName ${serverName}`);
        lines.push(`    ServerAdmin admin@${config.domain}`);
        lines.push('');
        lines.push('    # Error and access logs (Docker-friendly: stdout/stderr)');
        lines.push('    ErrorLog /proc/self/fd/2');
        lines.push('    CustomLog /proc/self/fd/1 combined');
        lines.push('');
        lines.push('    # ACME challenge directory (for Let\'s Encrypt HTTP-01 validation)');
        lines.push('    Alias /.well-known/acme-challenge/ /usr/local/apache2/htdocs/.well-known/acme-challenge/');
        lines.push('    <Directory "/usr/local/apache2/htdocs/.well-known/acme-challenge/">');
        lines.push('        Options None');
        lines.push('        AllowOverride None');
        lines.push('        Require all granted');
        lines.push('    </Directory>');
        lines.push('');
        lines.push('    # Redirect to HTTPS when certificates are present');
        lines.push(`    <IfFile "/usr/local/apache2/conf/ssl/${config.domain}.crt">`);
        lines.push('        RewriteEngine On');
        lines.push('        RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/');
        lines.push('        RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]');
        lines.push('    </IfFile>');
        lines.push('');
        lines.push(`    # Proxy to ${route.serviceName}`);
        lines.push(`    ProxyPass / http://${route.serviceName}:${route.port}/`);
        lines.push(`    ProxyPassReverse / http://${route.serviceName}:${route.port}/`);
        lines.push('</VirtualHost>');
        lines.push('');

        // SSL VirtualHost (activated when certs exist)
        lines.push(`<IfFile "/usr/local/apache2/conf/ssl/${config.domain}.crt">`);
        lines.push('<VirtualHost *:443>');
        lines.push(`    ServerName ${serverName}`);
        lines.push(`    ServerAdmin admin@${config.domain}`);
        lines.push('');
        lines.push('    SSLEngine on');
        lines.push(`    SSLCertificateFile /usr/local/apache2/conf/ssl/${config.domain}.crt`);
        lines.push(`    SSLCertificateKeyFile /usr/local/apache2/conf/ssl/${config.domain}.key`);
        lines.push('    SSLCACertificateFile /usr/local/apache2/conf/ssl/ca.crt');
        lines.push('');
        lines.push('    # Error and access logs (Docker-friendly: stdout/stderr)');
        lines.push('    ErrorLog /proc/self/fd/2');
        lines.push('    CustomLog /proc/self/fd/1 combined');
        lines.push('');
        lines.push(`    # Proxy to ${route.serviceName}`);
        lines.push(`    ProxyPass / http://${route.serviceName}:${route.port}/`);
        lines.push(`    ProxyPassReverse / http://${route.serviceName}:${route.port}/`);
        lines.push('</VirtualHost>');
        lines.push('</IfFile>');
        lines.push('');
      }
    }

    if (lines.length > 0) {
      const content = lines.join('\n');
      const filePath = join(proxyDir, fileName);
      await this.fileWriter.writeFile(filePath, content);
    }
  }

  /**
   * Builds main Apache configuration (httpd.conf)
   */
  private async buildApacheMainConfig(proxyDir: string, config: ProjectConfig): Promise<void> {
    const content = `# Apache HTTP Server Configuration
# Generated by Docker Project Builder

ServerRoot "/usr/local/apache2"
ServerName ${config.domain}

Listen 80
Listen 443

# Load required modules
LoadModule mpm_event_module modules/mod_mpm_event.so
LoadModule authn_file_module modules/mod_authn_file.so
LoadModule authn_core_module modules/mod_authn_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule authz_groupfile_module modules/mod_authz_groupfile.so
LoadModule authz_user_module modules/mod_authz_user.so
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule access_compat_module modules/mod_access_compat.so
LoadModule auth_basic_module modules/mod_auth_basic.so
LoadModule reqtimeout_module modules/mod_reqtimeout.so
LoadModule filter_module modules/mod_filter.so
LoadModule mime_module modules/mod_mime.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule env_module modules/mod_env.so
LoadModule headers_module modules/mod_headers.so
LoadModule setenvif_module modules/mod_setenvif.so
LoadModule version_module modules/mod_version.so
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule unixd_module modules/mod_unixd.so
LoadModule status_module modules/mod_status.so
LoadModule autoindex_module modules/mod_autoindex.so
LoadModule dir_module modules/mod_dir.so
LoadModule alias_module modules/mod_alias.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule ssl_module modules/mod_ssl.so
LoadModule socache_shmcb_module modules/mod_socache_shmcb.so

<IfModule unixd_module>
    User daemon
    Group daemon
</IfModule>

# Server admin
ServerAdmin admin@${config.domain}

# Document root (not used for proxying)
DocumentRoot "/usr/local/apache2/htdocs"

<Directory />
    AllowOverride none
    Require all denied
</Directory>

# Allow access to ACME challenge directory (for Let's Encrypt)
<Directory "/usr/local/apache2/htdocs/.well-known">
    Options None
    AllowOverride None
    Require all granted
</Directory>

# Error and access logs
ErrorLog /proc/self/fd/2
LogLevel warn

<IfModule log_config_module>
    LogFormat "%h %l %u %t \\"%r\\" %>s %b \\"%{Referer}i\\" \\"%{User-Agent}i\\"" combined
    LogFormat "%h %l %u %t \\"%r\\" %>s %b" common
    CustomLog /proc/self/fd/1 common
</IfModule>

# Proxy settings
ProxyRequests Off
ProxyPreserveHost On

<Proxy *>
    Order deny,allow
    Allow from all
</Proxy>

# SSL Configuration (enabled when certificates are present)
<IfModule ssl_module>
    <IfFile "/usr/local/apache2/conf/ssl/${config.domain}.crt">
        SSLCipherSuite HIGH:MEDIUM:!MD5:!RC4:!3DES
        SSLProxyCipherSuite HIGH:MEDIUM:!MD5:!RC4:!3DES
        SSLHonorCipherOrder on
        SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
        SSLProxyProtocol all -SSLv3 -TLSv1 -TLSv1.1
        SSLPassPhraseDialog  builtin
        SSLSessionCache "shmcb:/usr/local/apache2/logs/ssl_scache(512000)"
        SSLSessionCacheTimeout 300
    </IfFile>
</IfModule>

# Include vhosts
IncludeOptional conf/vhosts/*.conf
`;

    const filePath = join(proxyDir, 'httpd.conf');
    await this.fileWriter.writeFile(filePath, content);
  }
}
