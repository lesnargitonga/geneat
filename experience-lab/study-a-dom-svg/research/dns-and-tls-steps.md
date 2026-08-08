# DNS + TLS — exact manual steps

`dns_status: ACTION REQUIRED` — no authenticated DNS-provider access from this
environment. Records must be created by hand.

## Records to create

| record_type | hostname | target | proxy_mode | TTL | reason |
|---|---|---|---|---|---|
| A | `api.geneat.lesnarai.co.ke` | `102.203.116.141` | **DNS only** (proxy OFF) | 300 | Proxy off lets Let's Encrypt HTTP-01 reach the origin; enable proxy after the cert issues |
| A | `api.hazina.lesnarai.co.ke` | `102.203.116.141` | **DNS only** (proxy OFF) | 300 | Same |

`api.lesnarai.co.ke` is **legacy** — leave it alone. It still points at a
Cloudflare-proxied origin that returns error 1000. It is not part of the target
architecture and must not be reused.

## After the records resolve

Confirm propagation first — do not run certbot before this returns the VPS IP:

```bash
dig +short api.geneat.lesnarai.co.ke
dig +short api.hazina.lesnarai.co.ke
```

Then issue certificates on the VPS. The Nginx server blocks already exist and
listen on port 80 for these names, so the webroot challenge will work:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d api.geneat.lesnarai.co.ke --non-interactive --agree-tos -m <email> --redirect
certbot --nginx -d api.hazina.lesnarai.co.ke --non-interactive --agree-tos -m <email> --redirect
nginx -t && systemctl reload nginx
```

`certbot --nginx` edits the two product server blocks only. **CarePro's block
must not be passed to certbot** — it already has its own working TLS.

## Verify before claiming public status

```bash
curl -sS https://api.geneat.lesnarai.co.ke/healthz
curl -sS https://api.hazina.lesnarai.co.ke/healthz
```

Both must return a genuine application response, not an Nginx default page and
not a Cloudflare error. Only then may public status be upgraded on the site.

## Renewal

`certbot` installs a systemd timer. Confirm it exists rather than assuming:

```bash
systemctl list-timers | grep certbot
certbot renew --dry-run
```
