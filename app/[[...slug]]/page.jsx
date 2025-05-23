import React from "react";
import { ClientOnly } from "./client";

export function generateStaticParams() {
    return [
        { slug: [""] },
        { slug: [".well-known", "appspecific", "com.chrome.devtools.json"] },
    ];
}

export default function Page() {
    return <ClientOnly />;
}
