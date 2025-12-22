import React from "react";

/**
 * MindBridgeX route IO editor.
 *
 * Renders a JSON-friendly textarea with a safe placeholder that avoids JSX parsing errors.
 */
export default function RouteIoEditor(props) {
  return (
    <textarea
      aria-label="Route IO editor"
      className="w-full h-48 rounded-md border border-gray-300 bg-transparent p-3 font-mono text-sm"
      placeholder={`{\n  "message": "ok"\n}`}
      {...props}
    />
  );
}
