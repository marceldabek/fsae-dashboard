import type { FC, RefAttributes } from "react";
import { DotsVertical } from "@untitledui/icons";
import type {
    ButtonProps as AriaButtonProps,
    MenuItemProps as AriaMenuItemProps,
    MenuProps as AriaMenuProps,
    PopoverProps as AriaPopoverProps,
    SeparatorProps as AriaSeparatorProps,
} from "react-aria-components";
import {
    Button as AriaButton,
    Header as AriaHeader,
    Menu as AriaMenu,
    MenuItem as AriaMenuItem,
    MenuSection as AriaMenuSection,
    MenuTrigger as AriaMenuTrigger,
    Popover as AriaPopover,
    Separator as AriaSeparator,
} from "react-aria-components";
import { cx } from "@/utils/cx";

interface DropdownItemProps extends AriaMenuItemProps {
    /** The label of the item to be displayed. */
    label?: string;
    /** An addon to be displayed on the right side of the item. */
    addon?: string;
    /** If true, the item will not have any styles. */
    unstyled?: boolean;
    /** An icon to be displayed on the left side of the item. */
    icon?: FC<{ className?: string }>;
}

const DropdownItem = ({ label, children, addon, icon: Icon, unstyled, ...props }: DropdownItemProps) => {
    if (unstyled) {
        return <AriaMenuItem id={label} textValue={label} {...props} />;
    }

    return (
        <AriaMenuItem
            {...props}
            className={(state) =>
                cx(
                    "group block cursor-pointer px-1.5 py-px",
                    state.isDisabled && "cursor-not-allowed",
                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        >
            {(state) => (
                <div
                    className={cx(
                        "relative flex items-center rounded-md px-2.5 py-2 transition duration-100 ease-linear",
                        !state.isDisabled && "group-hover:bg-primary_hover",
                        state.isFocused && "bg-primary_hover",
                    )}
                >
                    {Icon && (
                        <Icon
                            aria-hidden="true"
                            className={cx("mr-2 size-4 shrink-0 stroke-[2.25px]", state.isDisabled ? "text-fg-disabled" : "text-fg-quaternary")}
                        />
                    )}

                    <span
                        className={cx(
                            "grow truncate text-sm font-semibold",
                            state.isDisabled ? "text-disabled" : "text-secondary",
                            state.isFocused && "text-secondary_hover",
                        )}
                    >
                        {label || (typeof children === "function" ? children(state) : children)}
                    </span>

                    {addon && (
                        <span
                            className={cx(
                                "ml-3 shrink-0 rounded px-1 py-px text-xs font-medium ring-1 ring-secondary ring-inset",
                                state.isDisabled ? "text-disabled" : "text-quaternary",
                            )}
                        >
                            {addon}
                        </span>
                    )}
                </div>
            )}
        </AriaMenuItem>
    );
};

interface DropdownMenuProps<T extends object> extends AriaMenuProps<T> {}

const DropdownMenu = <T extends object>(props: DropdownMenuProps<T>) => {
    return (
        <AriaMenu
            disallowEmptySelection
            selectionMode="single"
            {...props}
            className={(state) =>
                cx("h-min overflow-y-auto py-1 select-none", typeof props.className === "function" ? props.className(state) : props.className)
            }
        />
    );
};

interface DropdownPopoverProps extends AriaPopoverProps {}

const DropdownPopover = (props: DropdownPopoverProps) => {
    return (
        <AriaPopover
            placement="bottom right"
            {...props}
            className={(state) =>
                cx(
                    "w-62 origin-(--trigger-anchor-point) overflow-auto rounded-lg bg-primary shadow-lg border border-white/70 will-change-transform outline-none ring-0",
                    state.isEntering &&
                        "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                    state.isExiting &&
                        "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",
                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        >
            {props.children}
        </AriaPopover>
    );
};

const DropdownSeparator = (props: AriaSeparatorProps) => {
    return <AriaSeparator {...props} className={cx("my-1 h-px w-full bg-border-secondary", props.className)} />;
};

const DropdownDotsButton = (props: AriaButtonProps & RefAttributes<HTMLButtonElement>) => {
    return (
        <AriaButton
            {...props}
            aria-label="Open menu"
            className={(state) =>
                cx(
                    "cursor-pointer rounded-md text-fg-quaternary transition duration-100 ease-linear outline-none",
                    (state.isPressed || state.isHovered) && "text-fg-quaternary_hover",
                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        >
            <DotsVertical className="size-5 transition-inherit-all" />
        </AriaButton>
    );
};

export const Dropdown = {
    Root: AriaMenuTrigger,
    Popover: DropdownPopover,
    Menu: DropdownMenu,
    Section: AriaMenuSection,
    SectionHeader: AriaHeader,
    Item: DropdownItem,
    Separator: DropdownSeparator,
    DotsButton: DropdownDotsButton,
};
