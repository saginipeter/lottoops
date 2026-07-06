import { Panel } from "@/components/ui/panel";

export function ScanTimeline({
  logs,
}: any) {

  return (

    <Panel className="p-6">

      <h2 className="mb-6 text-xl font-semibold">

        Timeline

      </h2>

      <div className="space-y-5">

        {logs.map((log: any) => (

          <div key={log.id}>

            <div className="font-semibold">

              {log.action}

            </div>

            <div className="text-sm text-gray-500">

              {log.detail}

            </div>

            <div className="text-xs text-gray-400">

              {new Date(
                log.timestamp
              ).toLocaleString()}

            </div>

          </div>

        ))}

      </div>

    </Panel>

  );

}