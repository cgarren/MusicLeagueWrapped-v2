import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Music League Wrapped",
    description: "Insights and Awards from Music League",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
