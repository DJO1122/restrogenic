#!/usr/bin/env bash
# Vercel "build" for the static demo: copy ONLY the standalone HTML apps into
# public/ (so we don't run turbo and don't expose source). Vercel serves public/.
set -e

rm -rf public
mkdir -p public/saas

cp restrogenic-pos.html public/ 2>/dev/null || true
cp saas/super-admin.html public/saas/ 2>/dev/null || true
cp saas/signup.html public/saas/ 2>/dev/null || true

# Friendly landing page at the root URL
cat > public/index.html <<'HTML'
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RestroGenie</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#1e1b4b,#4338ca);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;padding:24px}
.box{text-align:center;max-width:520px}
.logo{width:72px;height:72px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:18px}
h1{font-size:34px;font-weight:800;margin-bottom:8px}
p{color:#c7d2fe;margin-bottom:28px}
.links{display:flex;flex-direction:column;gap:12px}
a{display:block;background:#fff;color:#312e81;text-decoration:none;font-weight:700;padding:15px;border-radius:12px;transition:.15s}
a:hover{transform:translateY(-2px)}
a small{display:block;font-weight:400;color:#64748b;font-size:12px;margin-top:2px}
</style></head><body>
<div class="box">
  <div class="logo">🍽️</div>
  <h1>RestroGenie</h1>
  <p>AI-powered restaurant billing &amp; management</p>
  <div class="links">
    <a href="/restrogenic-pos.html">🧾 Open POS (Billing)<small>Full point-of-sale — runs in your browser</small></a>
    <a href="/saas/super-admin.html">☁️ Super-Admin Panel<small>Manage all shops, plans &amp; billing</small></a>
    <a href="/saas/signup.html">🚀 Sign up a new shop<small>Pricing &amp; self-serve onboarding</small></a>
  </div>
</div></body></html>
HTML

echo "static build done → public/"
ls -1 public public/saas
