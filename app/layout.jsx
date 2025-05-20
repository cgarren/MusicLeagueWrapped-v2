import React from "react";
import "./globals.css";

export const metadata = {
    title: "Music League Wrapped",
    description: "Insights and Awards from Music League",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
