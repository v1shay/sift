/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
    rewrites: async () => {
        return [
            {
                source: "/api/py/:path*",
                destination: `${backendUrl}/api/py/:path*`,
            },
            {
                source: "/api/github/:path*",
                destination: `${backendUrl}/api/github/:path*`,
            },
        ];
    },
};

export default nextConfig;
