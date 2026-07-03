"use client";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import AssignPackDialog from "./assign-pack-dialog";

export default function DisplaySlotCard({
    slot,
}:{
    slot:any
}){

    if (!slot.pack) {

    return (

        <div className="rounded-xl border p-6">

            <h2 className="font-bold">

                Slot {slot.slotNumber}

            </h2>

            <div className="mt-8 text-center">

                <p className="mb-6">

                    Empty Slot

                </p>

                <AssignPackDialog

                    slotId={slot.id}

                />

            </div>

        </div>

    );

}

    const remaining =
        slot.pack.ticketQuantity -
        (slot.pack.currentTicketNumber -
        slot.pack.firstTicket);

    const percent =
        remaining /
        slot.pack.ticketQuantity *100;

    return(

        <div className="rounded-xl border p-6">

            <div className="flex justify-between">

                <h2 className="font-bold">

                    Slot {slot.slotNumber}

                </h2>

                <span className="rounded bg-green-100 px-2">

                    ACTIVE

                </span>

            </div>

            <div className="mt-5">

                <p className="font-semibold">

                    {slot.pack.game.name}

                </p>

                <p>

                    Game {slot.pack.gameNumber}

                </p>

                <p>

                    Pack {slot.pack.packNumber}

                </p>

            </div>

            <div className="mt-6">

                <Progress value={percent}/>

                <p className="mt-2">

                    {remaining} tickets remaining

                </p>

            </div>

            <Button

                className="mt-6 w-full"

            >

                Scan Sale

            </Button>

        </div>

    )

}