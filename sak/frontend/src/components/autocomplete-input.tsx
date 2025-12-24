import * as React from "react";
import { useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChoicesProps,
  InputProps,
  useChoices,
  useChoicesContext,
  useGetRecordRepresentation,
  useInput,
  useTranslate,
  FieldTitle,
  useEvent,
} from "ra-core";
import { InputHelperText } from "./input-helper-text";
import {
  SupportCreateSuggestionOptions,
  useSupportCreateSuggestion,
} from "@/hooks/useSupportCreateSuggestion";

import type { RaRecord } from "ra-core";

type Choice = RaRecord;

export const AutocompleteInput = (
  props: Omit<InputProps, "source"> &
    Omit<SupportCreateSuggestionOptions<Choice>, "handleChange" | "filter"> &
    Partial<Pick<InputProps, "source">> &
    ChoicesProps & {
      className?: string;
      disableValue?: string;
      filterToQuery?: (searchText: string) => Record<string, unknown>;
      translateChoice?: boolean;
      placeholder?: string;
      inputText?:
        | React.ReactNode
        | ((option: Choice | undefined) => React.ReactNode);
    },
) => {
  const {
    filterToQuery = DefaultFilterToQuery,
    inputText,
    create,
    createValue,
    createLabel,
    createHintValue,
    createItemLabel,
    onCreate,
    optionText,
  } = props;
  const {
    allChoices = [],
    source,
    resource,
    isFromReference,
    setFilters,
  } = useChoicesContext<Choice>(props);
  const { id, field, isRequired } = useInput({ ...props, source });
  const translate = useTranslate();
  const { placeholder = translate("ra.action.search", { _: "Search..." }) } =
    props;
  const { value: fieldValue, onChange: handleFieldChange } = field;

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const { getChoiceText, getChoiceValue } = useChoices({
    optionText:
      props.optionText ?? (isFromReference ? getRecordRepresentation : "name"),
    optionValue: props.optionValue ?? "id",
    disableValue: props.disableValue,
    translateChoice: props.translateChoice ?? !isFromReference,
  });

  const [filterValue, setFilterValue] = React.useState("");

  const [open, setOpen] = React.useState(false);
  const selectedChoice = allChoices.find(
    (choice) => getChoiceValue(choice) === fieldValue,
  );

  const getInputText = useCallback(
    (selectedChoice: Choice | undefined) => {
      if (typeof inputText === "function") {
        return inputText(selectedChoice);
      }
      if (inputText !== undefined) {
        return inputText;
      }
      return getChoiceText(selectedChoice);
    },
    [inputText, getChoiceText],
  );

  const handleOpenChange = useEvent((isOpen: boolean) => {
    setOpen(isOpen);
    // Reset the filter when the popover is closed
    if (!isOpen) {
      setFilters(filterToQuery(""));
    }
  });

  const handleChange = useCallback(
    (choice: Choice) => {
      if (fieldValue === getChoiceValue(choice) && !isRequired) {
        handleFieldChange("");
        setFilterValue("");
        if (isFromReference) {
          setFilters(filterToQuery(""));
        }
        setOpen(false);
        return;
      }
      handleFieldChange(getChoiceValue(choice));
      setOpen(false);
    },
    [
      fieldValue,
      handleFieldChange,
      getChoiceValue,
      isRequired,
      setFilterValue,
      isFromReference,
      setFilters,
      filterToQuery,
      setOpen,
    ],
  );

  const {
    getCreateItem,
    handleChange: handleChangeWithCreateSupport,
    createElement,
    getOptionDisabled,
  } = useSupportCreateSuggestion<Choice>({
    create,
    createLabel,
    createValue,
    createHintValue,
    createItemLabel,
    onCreate,
    handleChange: handleChange as (
      value: Choice | React.ChangeEvent<Element>
    ) => void,
    optionText,
    filter: filterValue,
  });

  const createItem =
    (create || onCreate) && (filterValue !== "" || createLabel)
      ? getCreateItem(filterValue)
      : null;
  let finalChoices = allChoices;
  if (createItem) {
    finalChoices = [...finalChoices, createItem];
  }

  return (
    <>
      <FormField className={props.className} id={id} name={source}>
        {props.label !== false && (
          <FormLabel>
            <FieldTitle
              label={props.label}
              source={props.source ?? source}
              resource={resource}
              isRequired={isRequired}
            />
          </FormLabel>
        )}
        <FormControl>
          <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between h-9 px-3 py-2 font-normal"
              >
                {selectedChoice ? (
                  <span className="text-sm font-normal">{getInputText(selectedChoice)}</span>
                ) : (
                  <span className="text-sm font-normal text-muted-foreground">{placeholder}</span>
                )}
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              {/* We handle the filtering ourselves */}
              <Command shouldFilter={!isFromReference}>
                <CommandInput
                  placeholder="Search..."
                  value={filterValue}
                  onValueChange={(filter) => {
                    setFilterValue(filter);
                    // We don't want the ChoicesContext to filter the choices if the input
                    // is not from a reference as it would also filter out the selected values
                    if (isFromReference) {
                      setFilters(filterToQuery(filter));
                    }
                  }}
                />
                <CommandList>
                  <CommandEmpty>No matching item found.</CommandEmpty>
                  <CommandGroup>
                    {finalChoices.map((choice) => {
                      const isCreateItem =
                        !!createItem && choice?.id === createItem.id;
                      const disabled = getOptionDisabled(choice);

                      return (
                        <CommandItem
                          key={getChoiceValue(choice)}
                          value={
                            isCreateItem
                              ? // if it's the create option, include the filter value so it is shown in the command input
                                // characters before and after the filter value are required
                                // to show the option when the filter value starts or ends with a space
                                `?${filterValue}?`
                              : getChoiceValue(choice)
                          }
                          onSelect={() => handleChangeWithCreateSupport(choice)}
                          disabled={disabled}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              field.value === getChoiceValue(choice)
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {getChoiceText(isCreateItem ? createItem : choice)}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </FormControl>
        <InputHelperText helperText={props.helperText} />
        <FormError />
      </FormField>
      {createElement}
    </>
  );
};

const DefaultFilterToQuery = (searchText: string) => ({ q: searchText });
