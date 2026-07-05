"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

interface Props {
    slotId: string;
}

export default function AssignPackDialog({
    slotId,
}: Props) {

    const [packs, setPacks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {

        if (!open) return;

        async function loadPacks() {

            const res = await fetch("/api/packs/back-stock");

            const data = await res.json();

            setPacks(data);

        }

        loadPacks();

    }, [open]);

    async function assign(packId: string) {

        setLoading(true);

        const res = await fetch("/api/activate-pack", {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({

                slotId,
                packId,

            }),

        });

        if (res.ok) {

            setOpen(false);

            window.location.reload();

        }

        setLoading(false);

    }

    return (

        <Dialog
            open={open}
            onOpenChange={setOpen}
        >

            <DialogTrigger asChild>

                <Button className="w-full">

                    Assign Pack

                </Button>

            </DialogTrigger>

            <DialogContent className="max-w-xl">

                <DialogHeader>

                    <DialogTitle>

                        Select Back Stock Pack

                    </DialogTitle>

                </DialogHeader>

                <div className="space-y-3">

                    {packs.length === 0 && (

                        <p className="text-sm text-gray-500">

                            No packs available.

                        </p>

                    )}

                    {packs.map((pack) => (

                        <div
                            key={pack.id}
                            className="flex items-center justify-between rounded-lg border p-4"
                        >

                            <div>

                                <h3 className="font-semibold">

                                    {pack.game.name}

                                </h3>

                                <p className="text-sm">

                                    Game #{pack.gameNumber}

                                </p>

                                <p className="text-sm">

                                    Pack #{pack.packNumber}

                                </p>

                                <p className="text-sm">

                                    {pack.ticketQuantity} tickets

                                </p>

                            </div>

                            <Button

                                disabled={loading}

                                onClick={() => assign(pack.id)}

                            >

                                Assign

                            </Button>

                        </div>

                    ))}

                </div>

            </DialogContent>

        </Dialog>

    );

}