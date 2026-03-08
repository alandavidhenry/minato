This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Azurite (local Azure Storage emulator)

### Local Development Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Install and start Azurite:**

```bash
# Install Azurite globally
npm install -g azurite

# Start Azurite (in a separate terminal)
azurite --silent --location c:\azurite --debug c:\azurite\debug.log
```

3. **Configure environment variables:**

Create a `.env.local` file in the root directory:

```env
# Use Azurite for local development
USE_AZURITE=true

# Next Auth Configuration
NEXTAUTH_SECRET=your-random-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Default admin email (optional)
DEFAULT_ADMIN_EMAIL=your-email@example.com
```

4. **Create an admin user:**

```bash
npm run setup:admin
```

This will prompt you to enter:
- Admin email
- Display name
- Password

**Save these credentials - you'll need them to log in!**

5. **Start the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials you created.

### Accessing the Application

- Navigate to [http://localhost:3000](http://localhost:3000)
- Click "Sign In" and use the email and password you created in step 4

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
