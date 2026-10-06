import https from 'node:https';
import { readFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';

const domain = process.env.APP_HOST;
if (!domain) throw new Error('Set APP_HOST to the HTTPS hostname');
const address = process.env.SERVER_IP || domain;
const ca = process.env.CA_FILE ? readFileSync(process.env.CA_FILE) : undefined;
const result = await new Promise((resolve, reject) => {
  const request = https.get(
    {
      hostname: address,
      port: 443,
      servername: domain,
      path: '/',
      ca,
      rejectUnauthorized: true,
      headers: { Host: domain },
    },
    (response) => {
      const certificate = new X509Certificate(response.socket.getPeerCertificate().raw);
      const spki = createHash('sha256')
        .update(certificate.publicKey.export({ type: 'spki', format: 'der' }))
        .digest('base64');
      response.resume();
      if (response.statusCode !== 200)
        reject(new Error(`Unexpected HTTPS response: ${response.statusCode}`));
      else
        resolve({
          domain,
          address,
          status: response.statusCode,
          authorized: response.socket.authorized,
          protocol: response.socket.getProtocol(),
          certificateFingerprint: certificate.fingerprint256,
          spki,
          csp: response.headers['content-security-policy'],
        });
    },
  );
  request.setTimeout(10000, () => request.destroy(new Error('HTTPS verification timed out')));
  request.on('error', reject);
});
console.info(JSON.stringify(result, null, 2));
