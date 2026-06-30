import { render, screen } from "@testing-library/react";
import { primitiveComponents } from "@/lib/jsonui/components/primitives";

it("Prose renders its text", () => {
  const Prose = primitiveComponents.Prose;
  render(<Prose props={{ text: "hello world" }} children={null} />);
  expect(screen.getByText("hello world")).toBeInTheDocument();
});
