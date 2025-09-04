import React from "react";
import { ClientOnly } from "./client";
import fs from "fs";
import path from "path";

export function generateStaticParams() {
    // Build-time scan of public/data to generate routes for leagues and seasons
    const dataDir = path.join(process.cwd(), "public", "data");
    const params = [
        { slug: [""] },
        { slug: [".well-known", "appspecific", "com.chrome.devtools.json"] },
    ];

    if (fs.existsSync(dataDir)) {
        const leagueDirs = fs
            .readdirSync(dataDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);

        leagueDirs.forEach((league) => {
            // Base league page
            params.push({ slug: [league] });

            const leaguePath = path.join(dataDir, league);
            const seasonDirs = fs
                .readdirSync(leaguePath, { withFileTypes: true })
                .filter((d) => d.isDirectory() && /^season\d+$/.test(d.name))
                .map((d) => d.name);

            seasonDirs.forEach((season) => {
                params.push({ slug: [league, season] });
            });
        });
    }

    return params;
}

export default function Page() {
    return <ClientOnly />;
}
