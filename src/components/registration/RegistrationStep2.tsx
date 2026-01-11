import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

// Brazilian states
const BRAZILIAN_STATES = [
    { value: "AC", label: "Acre" },
    { value: "AL", label: "Alagoas" },
    { value: "AP", label: "Amapá" },
    { value: "AM", label: "Amazonas" },
    { value: "BA", label: "Bahia" },
    { value: "CE", label: "Ceará" },
    { value: "DF", label: "Distrito Federal" },
    { value: "ES", label: "Espírito Santo" },
    { value: "GO", label: "Goiás" },
    { value: "MA", label: "Maranhão" },
    { value: "MT", label: "Mato Grosso" },
    { value: "MS", label: "Mato Grosso do Sul" },
    { value: "MG", label: "Minas Gerais" },
    { value: "PA", label: "Pará" },
    { value: "PB", label: "Paraíba" },
    { value: "PR", label: "Paraná" },
    { value: "PE", label: "Pernambuco" },
    { value: "PI", label: "Piauí" },
    { value: "RJ", label: "Rio de Janeiro" },
    { value: "RN", label: "Rio Grande do Norte" },
    { value: "RS", label: "Rio Grande do Sul" },
    { value: "RO", label: "Rondônia" },
    { value: "RR", label: "Roraima" },
    { value: "SC", label: "Santa Catarina" },
    { value: "SP", label: "São Paulo" },
    { value: "SE", label: "Sergipe" },
    { value: "TO", label: "Tocantins" },
];

// Step 2 schema: Address Information
const step2Schema = z.object({
    state: z.string().min(2, "Estado é obrigatório"),
    city: z.string().min(2, "Cidade é obrigatória"),
    address: z.string().min(5, "Endereço é obrigatório"),
    complement: z.string().optional(),
});

type Step2FormData = z.infer<typeof step2Schema>;

interface RegistrationStep2Props {
    onSubmit: (data: Step2FormData) => void;
    onBack: () => void;
    initialData?: Partial<Step2FormData>;
}

const RegistrationStep2: React.FC<RegistrationStep2Props> = ({
    onSubmit,
    onBack,
    initialData,
}) => {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<Step2FormData>({
        resolver: zodResolver(step2Schema),
        defaultValues: initialData || {
            state: "",
            city: "",
            address: "",
            complement: "",
        },
    });

    const handleSubmit = async (data: Step2FormData) => {
        setIsLoading(true);
        try {
            await onSubmit(data);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                disabled={isLoading}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o estado" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {BRAZILIAN_STATES.map((state) => (
                                        <SelectItem key={state.value} value={state.value}>
                                            {state.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="São Paulo"
                                    {...field}
                                    disabled={isLoading}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Rua, número, bairro"
                                    {...field}
                                    disabled={isLoading}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="complement"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Complemento (opcional)</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Apartamento, bloco, etc."
                                    {...field}
                                    disabled={isLoading}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onBack}
                        disabled={isLoading}
                        className="flex-1"
                    >
                        Voltar
                    </Button>
                    <Button
                        type="submit"
                        className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Finalizando...
                            </>
                        ) : (
                            "Concluir Cadastro"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
};

export default RegistrationStep2;
