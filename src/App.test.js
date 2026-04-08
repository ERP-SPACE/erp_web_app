// Smoke test: App component renders without crashing.
// More detailed tests live alongside their respective components.
import { render } from "@testing-library/react";
import App from "./App";

test("renders without crashing", () => {
  render(<App />);
});
