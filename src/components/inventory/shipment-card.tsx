import Image from "next/image";
import { Panel } from "@/components/ui/panel";

export function ShipmentCard({
  pack,
}: any) {

  return (

    <Panel className="p-6">

      <h2 className="mb-5 text-xl font-semibold">

        Shipment

      </h2>

      <div className="grid grid-cols-2 gap-6">

        <div>

          <p className="text-sm text-gray-500">

            Invoice

          </p>

          <p className="font-semibold">

            {pack.shipment.invoiceNumber}

          </p>

          <p className="mt-5 text-sm text-gray-500">

            Received By

          </p>

          <p className="font-semibold">

            {pack.receivedBy.name}

          </p>

        </div>

        <div>

          {pack.shipment.invoicePhoto && (

            <Image
              src={pack.shipment.invoicePhoto}
              alt="Invoice"
              width={400}
              height={250}
              className="rounded-lg border"
            />

          )}

        </div>

      </div>

    </Panel>

  );

}