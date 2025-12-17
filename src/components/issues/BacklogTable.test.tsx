// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InlineUserSelectCell } from "./InlineEditableCell";

describe("Assignee inline selector", () => {
  it("opens the dropdown and saves the selected assignee", async () => {
    const handleSave = vi.fn().mockResolvedValue(true);

    const Harness = () => (
      <InlineUserSelectCell
        value={null}
        options={[{ value: "user-1", label: "Ada Lovelace" }]}
        onSave={handleSave}
      />
    );

    render(<Harness />);

    await userEvent.click(screen.getByText("Unassigned"));

    const selector = await screen.findByRole("combobox");
    await userEvent.selectOptions(selector, "user-1");

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith("user-1");
    });
  });
});
