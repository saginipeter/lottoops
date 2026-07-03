"use client";

import DisplaySlotCard from "./display-slot-card";

export default function DisplaySlotGrid({
    slots,
}:{
    slots:any[]
}){

    return(

        <div className="grid grid-cols-4 gap-6">

            {slots.map(slot=>(
                <DisplaySlotCard
                    key={slot.id}
                    slot={slot}
                />
            ))}

        </div>

    )

}