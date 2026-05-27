/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8000");

const nextConfig = {
    rewrites: async () => {
        if (!backendUrl) return [];
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
