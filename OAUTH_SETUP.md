# OAuth Setup Guide

This guide explains how to set up Google and GitHub OAuth providers for your application.

## Prerequisites

- Supabase project with authentication enabled
- Access to Google Cloud Console (for Google OAuth)
- GitHub account with developer access (for GitHub OAuth)

## Google OAuth Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (if not already enabled)

### 2. Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace account)
3. Fill in the required information:
   - App name: Your application name
   - User support email: Your email
   - Developer contact information: Your email
4. Add your domain to **Authorized domains** (e.g., `yourdomain.com`)
5. Save and continue through the scopes and test users sections

### 3. Create OAuth Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client IDs**
3. Choose **Web application** as the application type
4. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (for development)
5. Copy the **Client ID** and **Client Secret**

### 4. Configure in Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** > **Providers**
3. Enable **Google** provider
4. Enter your **Client ID** and **Client Secret**
5. Save the configuration

## GitHub OAuth Setup

### 1. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the application details:
   - Application name: Your app name
   - Homepage URL: `https://yourdomain.com`
   - Authorization callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. Click **Register application**

### 2. Get Client Credentials

1. After creating the app, you'll see the **Client ID**
2. Click **Generate a new client secret** to get the **Client Secret**
3. Copy both values

### 3. Configure in Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** > **Providers**
3. Enable **GitHub** provider
4. Enter your **Client ID** and **Client Secret**
5. Save the configuration

## Environment Variables

Add these to your `.env` file (optional, as they're configured in Supabase):

```bash
# OAuth Providers (configure in Supabase Dashboard)
# Google OAuth - Get from Google Cloud Console
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth - Get from GitHub Developer Settings
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Testing OAuth Flow

1. Start your development server: `npm run dev`
2. Navigate to the sign-in page
3. Click on **Google** or **GitHub** buttons
4. Complete the OAuth flow
5. You should be redirected back to your application

## Troubleshooting

### Common Issues

1. **Redirect URI mismatch**: Ensure the callback URLs match exactly in both OAuth provider settings and Supabase configuration

2. **OAuth consent screen not configured**: Make sure you've completed the OAuth consent screen setup for Google

3. **Invalid client credentials**: Double-check that you've copied the Client ID and Client Secret correctly

4. **CORS errors**: Ensure your domain is added to authorized domains in Google Cloud Console

### Development vs Production

- For development: Use `http://localhost:3000/auth/callback`
- For production: Use your actual domain `https://yourdomain.com/auth/callback`
- Update both OAuth provider settings and Supabase configuration accordingly

## Security Notes

- Never commit OAuth client secrets to version control
- Use environment variables for sensitive credentials
- Regularly rotate OAuth client secrets
- Monitor OAuth usage in provider dashboards
- Implement proper error handling for OAuth failures

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
