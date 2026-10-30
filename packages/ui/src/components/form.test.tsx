import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { InputGroup } from "@heroui/react";
import { FormControl, FormItem, FormLabel, FormMessage } from "./form";

describe("FormControl", () => {
	it("forwards the generated id to the input inside a HeroUI InputGroup", () => {
		render(
			<FormItem>
				<FormLabel>Slug</FormLabel>
				<InputGroup data-testid="group">
					<FormControl render={<InputGroup.Input data-testid="input" />} />
				</InputGroup>
			</FormItem>,
		);

		const label = screen.getByText("Slug");
		const group = screen.getByTestId("group");
		const input = screen.getByTestId("input") as HTMLInputElement;

		expect(input).toHaveAttribute("id");
		expect(input.getAttribute("id")).toMatch(/-form-item$/);
		expect(label).toHaveAttribute("for", input.id);
		expect(group).not.toHaveAttribute("id", input.id);
	});

	it("includes message in aria-describedby when hasError=true", () => {
		render(
			<FormItem hasError>
				<FormControl render={(props) => <input {...props} data-testid="input" />} />
			</FormItem>,
		);

		const input = screen.getByTestId("input");
		const describedBy = input.getAttribute("aria-describedby");
		expect(describedBy).toContain("description");
		expect(describedBy).toContain("message");
		expect(input).toHaveAttribute("aria-invalid", "true");
	});
});

describe("FormMessage", () => {
	it("skips falsy and unrecognized errors and shows the first valid one", () => {
		const { rerender } = render(
			<FormItem hasError>
				<FormMessage errors={[null, undefined, { wrong: "field" }, "Valid"]} />
			</FormItem>,
		);
		expect(screen.getByText("Valid")).toBeInTheDocument();

		rerender(
			<FormItem hasError>
				<FormMessage errors={[null, { message: "Object error" }]} />
			</FormItem>,
		);
		expect(screen.getByText("Object error")).toBeInTheDocument();
	});
});
