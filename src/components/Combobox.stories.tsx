import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Combobox, type ComboboxItem } from "./Combobox";

const tokens: ComboboxItem[] = [
  { key: "XLM", label: "Stellar Lumens" },
  { key: "USDC", label: "USD Coin" },
  { key: "EURC", label: "Euro Coin" },
];

const meta = {
  title: "Components/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  args: {
    items: tokens,
    value: tokens[0]!,
    onChange: fn(),
    ariaLabel: "Token",
    triggerAriaLabel: "Select token",
    placeholder: "Search tokens",
    noMatchesLabel: "No matching tokens",
    renderTrigger: (item: ComboboxItem) => <span className="text-sm">{item.key}</span>,
    renderOption: (item: ComboboxItem) => <span className="block px-3 py-2 text-sm">{item.label}</span>,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Keyboard-operable listbox combobox. Arrow keys move the active option, " +
          "Home/End jump to the ends, Enter selects, and Escape closes and returns " +
          "focus to the trigger.",
      },
    },
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const KeyboardSelection: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    await step("open the listbox and focus the search input", async () => {
      await user.click(canvas.getByRole("button", { name: "Select token" }));
      await expect(canvas.getByRole("combobox")).toHaveFocus();
    });

    await step("move with arrow keys and select with Enter", async () => {
      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
      await expect(args.onChange).toHaveBeenCalledWith(tokens[2]);
      await expect(canvas.queryByRole("combobox")).not.toBeInTheDocument();
    });
  },
};

export const EscapeClosesAndRestoresFocus: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    await step("open the listbox", async () => {
      await user.click(canvas.getByRole("button", { name: "Select token" }));
      await expect(canvas.getByRole("listbox")).toBeInTheDocument();
    });

    await step("Escape closes without selecting and returns focus to the trigger", async () => {
      await user.keyboard("{Escape}");
      await expect(canvas.queryByRole("listbox")).not.toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "Select token" })).toHaveFocus();
      await expect(args.onChange).not.toHaveBeenCalled();
    });
  },
};
