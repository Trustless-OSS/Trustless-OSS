# Crawler & SEO Setup Quick Start

## What Was Added

This project now has **complete crawler/SEO configuration** ready for production.

### Files Created:

1. **`public/robots.txt`** — Tells bots what to crawl (fallback)
2. **`app/robots.ts`** — Dynamic robots.txt (recommended, takes priority)
3. **`public/sitemap.xml`** — Static page list (fallback)
4. **`app/sitemap.ts`** — Dynamic sitemap (recommended, takes priority)
5. **`public/humans.txt`** — Attribution file
6. **`public/.well-known/security.txt`** — Security contact point
7. **`app/layout.tsx` (enhanced)** — OpenGraph, Twitter cards, canonical URL, meta robots

---

## What This Means

### ✅ **Search Engines Can Now:**
- Discover the site via `robots.txt` & `sitemap.xml`
- Index public pages (/, /support, /connect, /login)
- Skip private pages (/dashboard, /profile, /auth, /api)
- Preview your content on social media with OG images
- Report security issues to you via `.well-known/security.txt`

### ✅ **Crawlers Will:**
- Respect rate limits (10s delay for aggressive bots)
- Find your sitemap automatically
- Know the canonical URL (prevents duplicate content in search)
- Get proper metadata for indexing

### ❌ **Won't Be Indexed:**
- `/dashboard/*` — private, behind auth
- `/profile/*` — private, behind auth
- `/api/*` — API endpoints (not HTML)
- `/_next/*` — build artifacts
- Staging/preview deployments (if you add env checks)

---

## Production Deployment Checklist

### Step 1: Configure Base URL
If deploying to a custom domain, update:

**`app/robots.ts`** line 4:
```typescript
const baseUrl = 'https://your-domain.com'; // Change this
```

**`app/sitemap.ts`** line 3:
```typescript
const baseUrl = 'https://your-domain.com'; // Change this
```

**`app/layout.tsx`** lines 15+ (OpenGraph):
```typescript
url: 'https://your-domain.com',
images: [{ url: 'https://your-domain.com/trustless-OSS.png', ... }],
```

### Step 2: Deploy & Verify

After deploying to production, test:

```bash
# Test robots.txt generation
curl https://your-domain.com/robots.txt

# Test sitemap generation
curl https://your-domain.com/sitemap.xml

# Test security.txt
curl https://your-domain.com/.well-known/security.txt
```

All three should return 200 OK with proper content.

### Step 3: Submit to Search Engines

#### **Google Search Console:**
1. Go to https://search.google.com/search-console
2. Add your domain/property
3. Click "Sitemaps" in the left menu
4. Add sitemap URL: `https://your-domain.com/sitemap.xml`
5. Wait for crawl (can take 24-48 hours)

#### **Bing Webmaster Tools:**
1. Go to https://www.bing.com/webmasters
2. Add your site
3. Submit sitemap: `https://your-domain.com/sitemap.xml`

#### **Other Search Engines (Optional):**
- Yandex.Webmaster
- Baidu Webmaster Tools
- DuckDuckGo (uses Google index by default)

### Step 4: Monitor & Maintain

- **Google Search Console** → Check errors, coverage, performance
- **Bing Webmaster Tools** → Check crawl stats, keywords
- **Monitor robots.txt** → Ensure no changes break crawling
- **Update sitemap.ts** → Add new public pages as you add routes

---

## Optional Enhancements

### 1. **Add Google Search Console Verification**
Once verified in Google Search Console, you'll get a verification code. Add it to `app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  // ... other metadata ...
  verification: {
    google: 'YOUR_VERIFICATION_CODE_HERE',
  },
};
```

### 2. **Add Structured Data (JSON-LD)**
For rich snippets in search results, add JSON-LD schemas to pages. Example in `app/page.tsx`:

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Trustless OSS',
      url: 'https://www.trustless-oss.xyz',
      description: 'Milestone-based rewards for OSS contributors',
      logo: 'https://www.trustless-oss.xyz/trustless-OSS.png',
    }),
  },
};
```

### 3. **Disable Crawling in Staging**
In `app/robots.ts`, add environment check:

```typescript
export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }
  
  // ... rest of production rules
}
```

### 4. **Add Breadcrumb Navigation**
Good for SEO. Example:
```html
<ol itemscope itemtype="https://schema.org/BreadcrumbList">
  <li><a href="/">Home</a></li>
  <li><a href="/support">Support</a></li>
</ol>
```

---

## Files Reference

| File | URL | Purpose |
|---|---|---|
| robots.txt | `https://your-domain.com/robots.txt` | Crawler rules |
| sitemap.xml | `https://your-domain.com/sitemap.xml` | Page index |
| humans.txt | `https://your-domain.com/humans.txt` | Attribution |
| security.txt | `https://your-domain.com/.well-known/security.txt` | Security contact |

---

## Troubleshooting

### `robots.txt` returning 404?
- Make sure `app/robots.ts` exists and exports a default function
- Run `pnpm build` to test

### `sitemap.xml` returning 404?
- Make sure `app/sitemap.ts` exists and exports a default function
- Check the base URL is correct

### Search engines not crawling?
1. Check robots.txt allows your domain
2. Submit sitemap in Google Search Console / Bing Webmaster Tools
3. Wait 24-48 hours for initial crawl
4. Check Search Console for crawl errors

### OG image not showing in social media previews?
1. Verify image URL is publicly accessible
2. Image should be ≥1200x630px
3. Use a social media preview checker:
   - Facebook: https://developers.facebook.com/tools/debug/
   - Twitter: https://cards-dev.twitter.com/validator
   - LinkedIn: https://www.linkedin.com/post-inspector/

---

## Security Note

⚠️ **`.well-known/security.txt`** tells security researchers how to report vulnerabilities.

Update it with:
- Your security contact email
- A security policy URL (if you have one)
- An acknowledgments/hall-of-fame page (if you have one)

Example for production:
```
Contact: security@www.trustless-oss.xyz
Expires: 2027-10-19T00:00:00.000Z
Policy: https://www.trustless-oss.xyz/security-policy
Acknowledgments: https://www.trustless-oss.xyz/security-acknowledgments
```

---

**Ready to deploy?** Follow the "Production Deployment Checklist" above. Your site is now crawler-friendly!

Last updated: 2026-10-19
