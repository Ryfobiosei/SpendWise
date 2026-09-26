# SpendWise Mobile

Native Expo client for the existing SpendWise Supabase project. The Vite web app remains in the repository root.

## Start on a device

1. Install Node.js and Expo Go on your phone.
2. From this folder, run `npm install`, then `npm run start`.
3. Scan the Expo QR code with Expo Go (Android) or the Camera app (iPhone).

The ignored `mobile/.env.local` contains the same public Supabase URL and publishable key as the web app's root `.env.local`. If you move this project to another computer, copy `mobile/.env.example` to `mobile/.env.local`, then set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the matching values from that Supabase project. Restart Expo after changing these values. Never put a Supabase secret or service-role key in this file.

## Email confirmation deep link

The installed app registers the `spendwise://` URL scheme. In Supabase, add `spendwise://auth/callback` under **Authentication → URL Configuration → Redirect URLs**. The mobile app passes this callback when it creates an account and handles Supabase token or PKCE code callbacks. Supabase still needs a working SMTP provider and an email confirmation template that preserves the requested redirect URL.

For confirmation-link testing, use a preview build installed on a phone. Expo Go uses its own temporary URL and cannot register the installed app's `spendwise://` scheme.

## Build installable apps

Because the local `.env.local` file is ignored and is not uploaded to remote build servers, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the **preview** (and later **production**) environment in your Expo project's Environment Variables settings. These are public client settings; do not add a Supabase secret or service-role key.

Install EAS CLI and sign in to an Expo account, then from this folder run:

```powershell
npx eas-cli build --platform android --profile preview
```

Use `--platform ios` for iOS or `--profile production` for store builds. The first EAS build asks to connect this app to an Expo project. Store submission still requires the relevant Apple or Google developer account and signing setup.

App identifiers are currently `com.spendwise.app` on both platforms. Choose identifiers owned by you before publishing if these are already in use.
