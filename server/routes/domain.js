const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All domain config routes require authentication
router.use(authenticateToken);

// GET /api/domain/config - Get domain configuration status
router.get('/config', (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM domain_config WHERE id = 1').get();

    if (!config) {
      return res.json({
        customDomain: null,
        domainVerified: false,
        sslProvisioned: false,
        wwwRedirect: 'www_to_apex',
        dnsConfigured: false,
        corsUpdated: false,
        spotifyRedirectUpdated: false,
        firebaseHostingConfigured: false,
        setupCompletedAt: null,
        setupSteps: generateSetupSteps(null),
      });
    }

    const response = {
      customDomain: config.custom_domain || null,
      domainVerified: !!config.domain_verified,
      sslProvisioned: !!config.ssl_provisioned,
      wwwRedirect: config.www_redirect || 'www_to_apex',
      dnsConfigured: !!config.dns_configured,
      corsUpdated: !!config.cors_updated,
      spotifyRedirectUpdated: !!config.spotify_redirect_updated,
      firebaseHostingConfigured: !!config.firebase_hosting_configured,
      setupCompletedAt: config.setup_completed_at || null,
      setupSteps: generateSetupSteps(config),
    };

    res.json(response);
  } catch (err) {
    console.error('Get domain config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/domain/config - Update domain configuration
router.put('/config', (req, res) => {
  try {
    const {
      customDomain,
      wwwRedirect,
      dnsConfigured,
      domainVerified,
      sslProvisioned,
      corsUpdated,
      spotifyRedirectUpdated,
      firebaseHostingConfigured,
    } = req.body;

    // Validate domain format if provided
    if (customDomain !== undefined && customDomain !== null && customDomain !== '') {
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(customDomain)) {
        return res.status(400).json({ error: 'Invalid domain format. Example: votebeats.com' });
      }
    }

    // Validate www redirect option
    const validRedirects = ['www_to_apex', 'apex_to_www', 'none'];
    if (wwwRedirect && !validRedirects.includes(wwwRedirect)) {
      return res.status(400).json({ error: 'Invalid www redirect option' });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (customDomain !== undefined) {
      updates.push('custom_domain = ?');
      params.push(customDomain || null);
    }
    if (wwwRedirect !== undefined) {
      updates.push('www_redirect = ?');
      params.push(wwwRedirect);
    }
    if (dnsConfigured !== undefined) {
      updates.push('dns_configured = ?');
      params.push(dnsConfigured ? 1 : 0);
    }
    if (domainVerified !== undefined) {
      updates.push('domain_verified = ?');
      params.push(domainVerified ? 1 : 0);
    }
    if (sslProvisioned !== undefined) {
      updates.push('ssl_provisioned = ?');
      params.push(sslProvisioned ? 1 : 0);
    }
    if (corsUpdated !== undefined) {
      updates.push('cors_updated = ?');
      params.push(corsUpdated ? 1 : 0);
    }
    if (spotifyRedirectUpdated !== undefined) {
      updates.push('spotify_redirect_updated = ?');
      params.push(spotifyRedirectUpdated ? 1 : 0);
    }
    if (firebaseHostingConfigured !== undefined) {
      updates.push('firebase_hosting_configured = ?');
      params.push(firebaseHostingConfigured ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push("updated_at = datetime('now')");

    // Check if setup is now complete
    const updatedConfig = db.prepare('SELECT * FROM domain_config WHERE id = 1').get();
    const mergedConfig = { ...updatedConfig };
    if (customDomain !== undefined) mergedConfig.custom_domain = customDomain || null;
    if (dnsConfigured !== undefined) mergedConfig.dns_configured = dnsConfigured ? 1 : 0;
    if (domainVerified !== undefined) mergedConfig.domain_verified = domainVerified ? 1 : 0;
    if (sslProvisioned !== undefined) mergedConfig.ssl_provisioned = sslProvisioned ? 1 : 0;
    if (corsUpdated !== undefined) mergedConfig.cors_updated = corsUpdated ? 1 : 0;
    if (spotifyRedirectUpdated !== undefined) mergedConfig.spotify_redirect_updated = spotifyRedirectUpdated ? 1 : 0;
    if (firebaseHostingConfigured !== undefined) mergedConfig.firebase_hosting_configured = firebaseHostingConfigured ? 1 : 0;

    const isComplete = mergedConfig.custom_domain &&
      mergedConfig.dns_configured &&
      mergedConfig.domain_verified &&
      mergedConfig.ssl_provisioned &&
      mergedConfig.cors_updated &&
      mergedConfig.spotify_redirect_updated &&
      mergedConfig.firebase_hosting_configured;

    if (isComplete && !updatedConfig.setup_completed_at) {
      updates.push("setup_completed_at = datetime('now')");
    } else if (!isComplete) {
      updates.push('setup_completed_at = NULL');
    }

    const sql = `UPDATE domain_config SET ${updates.join(', ')} WHERE id = 1`;
    db.prepare(sql).run(...params);

    // Return updated config
    const config = db.prepare('SELECT * FROM domain_config WHERE id = 1').get();

    console.log(`[Domain] Configuration updated: ${config.custom_domain || 'no domain'}`);

    res.json({
      customDomain: config.custom_domain || null,
      domainVerified: !!config.domain_verified,
      sslProvisioned: !!config.ssl_provisioned,
      wwwRedirect: config.www_redirect || 'www_to_apex',
      dnsConfigured: !!config.dns_configured,
      corsUpdated: !!config.cors_updated,
      spotifyRedirectUpdated: !!config.spotify_redirect_updated,
      firebaseHostingConfigured: !!config.firebase_hosting_configured,
      setupCompletedAt: config.setup_completed_at || null,
      setupSteps: generateSetupSteps(config),
      message: 'Domain configuration updated successfully',
    });
  } catch (err) {
    console.error('Update domain config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/domain/dns-instructions - Get DNS setup instructions for the configured domain
router.get('/dns-instructions', (req, res) => {
  try {
    const config = db.prepare('SELECT custom_domain, www_redirect FROM domain_config WHERE id = 1').get();

    if (!config || !config.custom_domain) {
      return res.status(400).json({ error: 'No custom domain configured. Set a domain first.' });
    }

    const domain = config.custom_domain;
    const wwwRedirect = config.www_redirect || 'www_to_apex';

    const instructions = {
      domain,
      wwwRedirect,
      steps: [
        {
          step: 1,
          title: 'Add TXT record for domain verification',
          type: 'TXT',
          name: domain,
          value: `firebase-hosting-verification=${domain.replace(/\./g, '-')}`,
          description: 'This verifies you own the domain. Add this to your DNS provider.',
        },
        {
          step: 2,
          title: 'Add A records for Firebase Hosting',
          type: 'A',
          name: domain,
          values: ['151.101.1.195', '151.101.65.195'],
          description: 'These A records point your domain to Firebase Hosting servers.',
        },
      ],
      corsConfig: {
        description: 'Add your custom domain to the CORS_ORIGIN environment variable on the server.',
        example: `CORS_ORIGIN=http://localhost:3000,https://${domain},https://www.${domain}`,
      },
      spotifyConfig: {
        description: 'Update the Spotify redirect URI in your Spotify Developer Dashboard.',
        oldValue: 'http://localhost:3002/api/spotify/callback',
        newValue: `https://${domain}/api/spotify/callback`,
      },
    };

    // Add www redirect record
    if (wwwRedirect === 'www_to_apex') {
      instructions.steps.push({
        step: 3,
        title: 'Add CNAME record for www redirect',
        type: 'CNAME',
        name: `www.${domain}`,
        value: domain,
        description: `Redirects www.${domain} to ${domain} (apex domain).`,
      });
    } else if (wwwRedirect === 'apex_to_www') {
      instructions.steps.push({
        step: 3,
        title: 'Add CNAME record for www',
        type: 'CNAME',
        name: `www.${domain}`,
        value: `${domain.replace(/\./g, '-')}.web.app`,
        description: `Points www.${domain} to Firebase Hosting. Apex will redirect to www.`,
      });
    }

    res.json(instructions);
  } catch (err) {
    console.error('Get DNS instructions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate setup steps checklist
function generateSetupSteps(config) {
  const domain = config?.custom_domain || 'yourdomain.com';
  return [
    {
      id: 'domain',
      title: 'Configure custom domain',
      description: `Set your custom domain (e.g., ${domain})`,
      completed: !!config?.custom_domain,
    },
    {
      id: 'dns',
      title: 'Configure DNS records',
      description: 'Add A records and TXT verification at your domain registrar',
      completed: !!config?.dns_configured,
    },
    {
      id: 'firebase',
      title: 'Add domain to Firebase Hosting',
      description: 'Run firebase hosting:channel:deploy or use Firebase Console',
      completed: !!config?.firebase_hosting_configured,
    },
    {
      id: 'verify',
      title: 'Verify domain ownership',
      description: 'Firebase verifies your DNS records and provisions SSL',
      completed: !!config?.domain_verified,
    },
    {
      id: 'ssl',
      title: 'SSL certificate provisioned',
      description: 'Automatic SSL via Firebase (may take up to 24 hours)',
      completed: !!config?.ssl_provisioned,
    },
    {
      id: 'cors',
      title: 'Update CORS configuration',
      description: `Add https://${domain} to CORS_ORIGIN on the server`,
      completed: !!config?.cors_updated,
    },
    {
      id: 'spotify',
      title: 'Update Spotify redirect URIs',
      description: `Update redirect URI to https://${domain}/api/spotify/callback`,
      completed: !!config?.spotify_redirect_updated,
    },
    {
      id: 'www',
      title: 'Set up www redirect',
      description: config?.www_redirect === 'apex_to_www'
        ? `Redirect ${domain} to www.${domain}`
        : `Redirect www.${domain} to ${domain}`,
      completed: !!config?.dns_configured && !!config?.domain_verified,
    },
  ];
}

module.exports = router;
