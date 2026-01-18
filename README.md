This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## OneSignal Push Notifications

This project includes an optional OneSignal web SDK integration. To enable it locally or in production:

- Add `NEXT_PUBLIC_ONESIGNAL_APP_ID` to your environment (already added to `.env.local` during setup). Do NOT store sensitive keys other than the public App ID here.
- The repository contains service workers required by OneSignal at `public/OneSignalSDKWorker.js` and `public/OneSignalSDKUpdaterWorker.js` which import OneSignal's SW from the CDN.

Testing locally:

1. Run the dev server: `npm run dev`.
2. By default the OneSignal SDK **will not** be initialized in development to avoid interfering with dev HMR and asset loading. If you need to enable it for testing, set `NEXT_PUBLIC_ONESIGNAL_ENABLE_IN_DEV=true` in `.env.local` and restart the dev server.
3. Open your site at `http://localhost:3000` and check the browser console / network tab. If enabled, you should see the OneSignal SDK loaded from `https://cdn.onesignal.com` and the service worker registered at `/OneSignalSDKWorker.js`.
4. If you previously saw `Failed to fetch` or many `sw.js` errors, clean up by going to DevTools → Application → Service Workers and **unregister** any existing `/sw.js` or `OneSignalSDKWorker.js`, then clear site data (Caches / Storage) and hard reload the page (Ctrl+Shift+R).

Optional: implement a user consent prompt before initializing OneSignal (we can add this flow if you want).

---

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
