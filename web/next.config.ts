import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/sessions', destination: '/expert/sessions', permanent: false },
      { source: '/sessions/:id', destination: '/expert/sessions/:id', permanent: false },
      { source: '/sessions/:id/debrief', destination: '/expert/sessions/:id/debrief', permanent: false },
      { source: '/sessions/:id/map', destination: '/expert/sessions/:id/map', permanent: false },
      { source: '/sessions/:id/privacy', destination: '/expert/sessions/:id/privacy', permanent: false },
      { source: '/tutor', destination: '/learn', permanent: false },
    ]
  },
}

export default nextConfig
