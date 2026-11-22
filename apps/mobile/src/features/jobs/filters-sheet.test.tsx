// The job search's filters (plans/mobile Phase 09): each change goes to the search without running it, minimum pay
// keeps its digits and takes the country's currency, and the country list finds a country by name.
import { fireEvent, screen } from "@testing-library/react-native";
import { jobsSearchSchema } from "@rezumi/career/jobs";
import { CountryList, Filters } from "./filters-sheet";
import { renderScreen } from "@/test/render-screen";

const search = jobsSearchSchema.parse({ q: "Nurse", country: "GB" });

describe("Filters", () => {
	it("changes how it's worked, the level and visa sponsorship", async () => {
		const onChange = jest.fn();
		await renderScreen(
			<Filters value={search} onChange={onChange} onPickCountry={jest.fn()} onPickCurrency={jest.fn()} />,
		);
		expect(screen.getByText("Remote in this country")).toBeTruthy();
		await fireEvent.press(screen.getByText("Hybrid"));
		expect(onChange).toHaveBeenCalledWith({ arrangement: "hybrid" });
		await fireEvent.press(screen.getByText("Senior"));
		expect(onChange).toHaveBeenCalledWith({ level: "senior" });
		await fireEvent.press(screen.getByText("Last week"));
		expect(onChange).toHaveBeenCalledWith({ posted: 7 });
	});

	it("keeps only the digits of the minimum pay, in the country's currency", async () => {
		const onChange = jest.fn();
		await renderScreen(
			<Filters value={search} onChange={onChange} onPickCountry={jest.fn()} onPickCurrency={jest.fn()} />,
		);
		await fireEvent.changeText(screen.getByTestId("jobs-filter-pay"), "£55,000");
		expect(onChange).toHaveBeenLastCalledWith({ minPay: 55_000, currency: "GBP" });
		await fireEvent.changeText(screen.getByTestId("jobs-filter-pay"), "");
		expect(onChange).toHaveBeenLastCalledWith({ minPay: undefined, currency: undefined });
	});

	it("says anywhere when no country is chosen, and opens the country list", async () => {
		const onPickCountry = jest.fn();
		await renderScreen(
			<Filters
				value={{ ...search, country: "" }}
				onChange={jest.fn()}
				onPickCountry={onPickCountry}
				onPickCurrency={jest.fn()}
			/>,
		);
		expect(screen.getByText("Remote anywhere")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("jobs-filter-country"));
		expect(onPickCountry).toHaveBeenCalled();
	});
});

describe("CountryList", () => {
	it("finds a country by name, and offers anywhere first", async () => {
		const onPick = jest.fn();
		await renderScreen(<CountryList value="GB" onPick={onPick} />);
		await fireEvent.press(screen.getByText("Anywhere"));
		expect(onPick).toHaveBeenCalledWith("");
		await fireEvent.changeText(screen.getByLabelText("Search countries"), "germ");
		await fireEvent.press(screen.getByText("Germany"));
		expect(onPick).toHaveBeenCalledWith("DE");
	});
});
