import type { DateInputProps as AriaDateInputProps } from "react-aria-components";
import { DateInput as AriaDateInput, DateSegment as AriaDateSegment } from "react-aria-components";
import { cx } from "@/utils/cx";

interface DateInputProps extends Omit<AriaDateInputProps, "children"> {
    theme?: "default" | "white";
}

export const DateInput = (props: DateInputProps) => {
    const theme = props.theme ?? "default";
    return (
        <AriaDateInput
            {...props}
            className={cx(
                "flex rounded-lg px-2.5 py-2 text-md shadow-xs ring-1 ring-inset focus-within:ring-2",
                theme === "white" ? "bg-white/10 text-white ring-white/50 focus-within:ring-white/50" : "bg-primary ring-primary focus-within:ring-brand",
                typeof props.className === "string" && props.className,
            )}
        >
            {(segment) => (
                <AriaDateSegment
                    segment={segment}
                    className={cx(
                        "rounded px-0.5 tabular-nums caret-transparent focus:bg-brand-solid focus:font-medium focus:text-white focus:outline-hidden",
                        theme === "white" ? "text-white" : "text-primary",
                        // The placeholder segment.
                        segment.isPlaceholder && (theme === "white" ? "text-white/70 uppercase" : "text-placeholder uppercase"),
                        // The separator "/" segment.
                        segment.type === "literal" && (theme === "white" ? "text-white/70" : "text-fg-quaternary"),
                    )}
                />
            )}
        </AriaDateInput>
    );
};
