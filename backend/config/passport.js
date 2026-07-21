require("./env");
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

function isConfiguredSecret(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !(
    normalized === 'your_google_client_id_here' ||
    normalized === 'your_google_client_secret_here' ||
    normalized.includes('your_') ||
    normalized.includes('_here')
  );
}

const hasGoogleOAuth =
  isConfiguredSecret(process.env.GOOGLE_CLIENT_ID) &&
  isConfiguredSecret(process.env.GOOGLE_CLIENT_SECRET);

if (hasGoogleOAuth) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
      },
      (accessToken, refreshToken, profile, done) => {
        const user = {
          googleId: profile.id,
          email: profile.emails?.[0]?.value || '',
          firstName: profile.name?.givenName || '',
          lastName: profile.name?.familyName || '',
          photo: profile.photos?.[0]?.value || '',
        };
        return done(null, user);
      }
    )
  );
} else {
  console.warn('Google OAuth chưa được cấu hình. Email/password login vẫn dùng bình thường.');
}

module.exports = passport;
module.exports.hasGoogleOAuth = hasGoogleOAuth;
