import withPWA from 'next-pwa'

const pwaConfig = withPWA({
  dest: 'public',
  register: false, // We register our custom SW manually in ServiceWorkerRegister component
  skipWaiting: true,
  disable: true, // Disable next-pwa's auto-generated SW - we use our own custom sw.js
  buildExcludes: [/app-build-manifest\.json$/],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Empty turbopack config to silence Next.js 16 warning about webpack config
  turbopack: {},
}

export default pwaConfig(nextConfig)
