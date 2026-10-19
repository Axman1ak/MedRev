/** @type {import('next').NextConfig} */
const nextConfig = {
  // L'adresse Vercel de production renvoie vers le vrai domaine, pour que
  // Google n'indexe plus le site en double. Les aperçus des pull requests
  // (autres adresses vercel.app) ne sont pas touchés.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'med-rev-eight.vercel.app' }],
        destination: 'https://www.medrev.fr/:path*',
        permanent: true,
      },
    ]
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

module.exports = nextConfig
