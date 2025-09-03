import React from "react";
import { ClientOnly } from "./client";

export function generateStaticParams() {
    return [
        { slug: [""] },
        { slug: ["suit-and-tie"] },
        { slug: ["amherst"] },
        { slug: ["harvard-law-music-club"] },
        { slug: [".well-known", "appspecific", "com.chrome.devtools.json"] },
    ];
}

export default function Page() {
    return <ClientOnly />;
}
