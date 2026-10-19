# SEO & Search Engine Configuration

This document describes the SEO setup for Trustless OSS and how search engines and crawlers interact with the site.

## Files & Configuration

### 1. **`public/robots.txt`**
Static robots.txt file that tells search engines and bots which parts of the site to crawl.

**Key Rules:**
- ✅ **Allowed**: `/`, `/support`, `/connect`, `/login`
- ❌ **Disallowed**: `/dashboard`, `/profile`, `/auth/`, `/api/`, `/_next/`
- **Crawl Delay**: 10s for aggressive bots (AhrefsBot, SemrushBot, DotBot)

**Why?**
- Public pages (landing, support, login) should be indexed for discovery
- Private pages (dashboard, profile) are behind authentication and don't need indexing
- API routes shouldn't be indexed (they return JSON, not HTML)

### 2. **`app/robots.ts`** (Recommended)
Dynamic robots.ts file (Next.js App Router) that generates robots.txt at runtime. This takes priority over the static file and allows environment-specific rules.

**Advantages over static `robots.txt`:**
- Can read environment variables (e.g., `NODE_ENV === 'production'`)
- Can disable all crawling in staging/preview deployments
- Automatically generates the correct base URL

**Example: Disable crawling in staging:**
```typescript
const isProduction = process.env.NODE_ENV === 'production';
const rules = isProduction ? [...publicRules] : [{ userAgent: '*', disallow: '/' }];
```

### 3. **`public/sitemap.xml`** (Static Fallback)
XML sitemap listing all public pages. Helps search engines discover and prioritize pages.

**Structure:**
- `/<url>` → priority 1.0 (main landing)
- `/support` → priority 0.8 (important)
- `/connect` → priority 0.7 (entry point)
- `/login` → priority 0.3 (low, authentication)

**Priorities:**
- `1.0` = highest priority (landing page)
- `0.8` = high (key public content)
- `0.7` = medium (secondary entry points)
- `0.3` = low (support/auth pages, not for discovery)

### 4. **`app/sitemap.ts`** (Recommended)
Dynamic sitemap.ts file (Next.js App Router) that generates sitemap.xml at runtime. Takes priority over the static file.

**Why dynamic?**
- Can include dynamic pages (e.g., list of indexed repos if public)
- Uses current date for `lastModified`
- Can exclude staging/preview deployments

### 5. **Enhanced Metadata in `app/layout.tsx`**
Root layout now includes comprehensive metadata:
- **Title & Description**: Clear, keyword-rich
- **Open Graph (OG) Tags**: For social media previews (LinkedIn, Twitter, Facebook)
- **Twitter Card**: Specific Twitter preview formatting
- **Keywords**: SEO terms for search engines
- **Canonical URL**: Prevents duplicate content issues
- **Robots Meta**: Explicit indexing instructions
- **Verification Fields**: For Google Search Console, Bing Webmaster Tools

**Open Graph Example:**
```
og:title: "Trustless OSS | Milestone-Based Rewards for Contributors"
og:image: "https://www.trustless-oss.xyz/trustless-OSS.png" (1200x630px)
og:description: "Milestone-based rewards for open-source contributors..."
```

When you share the link on LinkedIn, Slack, Twitter, Facebook, etc., the preview will use these tags.

### 6. **`public/humans.txt`**
Human-readable attribution file. Commonly checked by humans reviewing site credits.

**Location:** `https://www.trustless-oss.xyz/humans.txt`

### 7. **`public/.well-known/security.txt`**
Standard security contact point (RFC 9110). Tells security researchers how to report vulnerabilities.

**Locations that will be checked:**
- `https://www.trustless-oss.xyz/.well-known/security.txt`
- Provides contact email, expiration, and policy links

---

## How to Use / Integration

### **For Development:**
No action needed. The dynamic `app/robots.ts` and `app/sitemap.ts` are generated automatically.

### **For Production Deployment:**

1. **Update the base URL** in `app/robots.ts` and `app/sitemap.ts` if deploying to a different domain:
   ```typescript
   const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.trustless-oss.xyz';
   ```

2. **Add environment variable** to your `.env.production`:
   ```
   NEXT_PUBLIC_BASE_URL=https://www.trustless-oss.xyz
   ```

3. **Verify robots.txt & sitemap after deploy:**
   - `https://www.trustless-oss.xyz/robots.txt`
   - `https://www.trustless-oss.xyz/sitemap.xml`

4. **Submit to search engines:**
   - **Google Search Console**: https://search.google.com/search-console
   - **Bing Webmaster Tools**: https://www.bing.com/webmasters
   - Upload `sitemap.xml` URL to both

### **For Staging/Preview:**
If using `app/robots.ts`, add logic to block all crawlers:
```typescript
if (!isProduction) {
  rules = [{ userAgent: '*', disallow: '/' }];
}
```
This prevents preview URLs from being indexed.

---

## SEO Checklist

- ✅ `robots.txt` configured (public pages allowed, private pages blocked)
- ✅ `sitemap.xml` with all public pages and priorities
- ✅ Open Graph tags for social sharing
- ✅ Twitter Card tags for Twitter preview
- ✅ Canonical URL set
- ✅ Meta robots tags in head
- ✅ Keywords & description for SEO
- ✅ Mobile viewport configured
- ✅ Color scheme for dark/light mode
- ✅ Theme color for browser chrome
- ✅ Security.txt for vulnerability reporting
- ⏳ Google Search Console verification (add `verification.google` value once obtained)
- ⏳ Bing Webmaster Tools verification

---

## Files Location Reference

| File | Location | Type | Purpose |
|---|---|---|---|
| `robots.txt` | `public/robots.txt` | Static | Crawler rules (fallback) |
| `robots.ts` | `app/robots.ts` | Dynamic | Crawler rules (recommended) |
| `sitemap.xml` | `public/sitemap.xml` | Static | Page list for discovery (fallback) |
| `sitemap.ts` | `app/sitemap.ts` | Dynamic | Page list (recommended) |
| `humans.txt` | `public/humans.txt` | Static | Attribution file |
| `security.txt` | `public/.well-known/security.txt` | Static | Security contact |
| Metadata | `app/layout.tsx` | Code | OG tags, Twitter, canonical |

---

## Notes

- **Why both static and dynamic files?** The static files act as fallback for older build systems; the dynamic files are the source of truth for Next.js App Router.
- **Why no crawl on `/dashboard`?** It's behind authentication. Search engines can't log in, so pages would return 401/403 or a login redirect—cluttering search results.
- **Can repos be indexed?** If you add public repo listing pages (e.g., `/repos`), they can be indexed. Currently all repo pages are in `/dashboard` (private).
- **What about structured data (JSON-LD)?** This can be added in future to mark up breadcrumbs, organization, and FAQ schemas for rich snippets.

---

## Quick Commands

```bash
# Check robots.txt is generated
curl https://www.trustless-oss.xyz/robots.txt

# Check sitemap is generated
curl https://www.trustless-oss.xyz/sitemap.xml

# Check security.txt
curl https://www.trustless-oss.xyz/.well-known/security.txt

# Local preview (dev mode)
pnpm dev
# Visit http://localhost:3000/robots.txt
```

---

Last updated: 2026-10-19
