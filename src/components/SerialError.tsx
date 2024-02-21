import { XCircleIcon } from "@heroicons/react/24/outline";
import { Alert, Link } from "react-daisyui";

export const SerialError = () => (
  <Alert status={"error"}>
    <XCircleIcon className="h-6 w-6" />
    <span>
      ERROR: No web USB available. Use{" "}
      <Link className="underline" href="https://www.google.com/chrome/">
        Chrome
      </Link>{" "}
      browser.
    </span>
  </Alert>
);
