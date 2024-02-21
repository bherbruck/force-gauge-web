import { useEffect, useMemo, useState } from "react";
import { Chart, type AxisOptions } from "react-charts";
import { SerialError } from "./components/SerialError";
import { ModbusRTUService } from "./lib/modbus/modbusRTU";

type Datum = {
  x: number;
  y: number;
};

const getReading = async (modbus: ModbusRTUService) => {
  try {
    const response = await modbus.readHoldingRegisters(1, 0, 2);
    const view = new DataView(response.buffer);
    const value = view.getFloat32(0, false);
    return Number(Math.abs(value).toFixed(2));
  } catch (err) {
    console.error("Error reading:", err);
  }
};

const App = () => {
  const [modbus, setModbus] = useState<ModbusRTUService>();
  // @ts-expect-error not implemented
  const [force, setForce] = useState<number>();
  // @ts-expect-error not implemented
  const [sliceSize, setSliceSize] = useState(100);
  const [timeseries, setTimeseries] = useState<number[]>([]);
  const [peaks, setPeaks] = useState<number[]>([]);

  const rawChartData: Datum[] = Array.from(
    { length: sliceSize - timeseries.length },
    () => 0
  )
    .concat(timeseries)
    .slice(-sliceSize)
    .map((value, index) => ({ x: index, y: value }));

  const primaryAxis = useMemo(
    (): AxisOptions<Datum> => ({
      getValue: (datum) => datum.x,
      scaleType: "linear",
      showGrid: false,
      show: false,
    }),
    []
  );

  const secondaryAxes = useMemo(
    (): AxisOptions<Datum>[] => [
      {
        getValue: (datum) => datum.y,
        scaleType: "linear",
        max: 1,
        hardMin: 0,
        elementType: "line",
      },
    ],
    []
  );

  useEffect(() => {
    if (!modbus) return;

    const isLooping = new AbortController(); // Used for cleanup

    const loop = async () => {
      let previous = 0;
      let consecutiveZeros = 0;
      let peak = 0;

      while (!isLooping.signal.aborted) {
        const value = await getReading(modbus);

        if (isLooping.signal.aborted) break; // Check if we need to exit the loop

        if ((value === previous && value > 0) || value == undefined) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }
        if (value > 0) consecutiveZeros = 0;
        if (value === 0) {
          if (peak > 0) setPeaks((peaks) => [...peaks, peak]);
          peak = 0;
          await new Promise((resolve) => setTimeout(resolve, 250));
          consecutiveZeros++;
          if (consecutiveZeros > 5) {
            continue;
          }
        }

        console.log("Reading:", value);
        setForce(value); // This is safe because it's a setter function
        setTimeseries((timeseries) => [...timeseries, value]);
        previous = value;
        peak = Math.max(peak, value);
      }
    };

    loop();

    return () => {
      isLooping.abort();
    };
  }, [modbus]);

  const connect = async () => {
    console.log("Connecting...");
    try {
      const port = await navigator.serial.requestPort();
      const modbus = new ModbusRTUService(port);
      await modbus.connect();
      setModbus(modbus);
      console.log("Connected");
    } catch (err) {
      console.error("Error connecting:", err);
    }
  };

  const disconnect = async () => {
    console.log("Disconnecting...");
    if (modbus) {
      await modbus.disconnect();
      setModbus(undefined);
      console.log("Disconnected");
    }
  };

  const resetChart = () => {
    setTimeseries([]);
  };

  return (
    <div className="flex flex-col p-2 gap-2 h-screen">
      {!navigator.serial && <SerialError />}

      <div className="flex flex-row gap-2">
        <button
          className="btn btn-primary"
          onClick={modbus ? disconnect : connect}
        >
          {modbus ? "Disconnect" : "Connect"}
        </button>

        <button className="btn" onClick={resetChart}>
          Clear Chart
        </button>
      </div>
      <div className="flex flex-col md:flex-row flex-1">
        <div className="flex-1">
          <Chart
            options={{
              data: [{ label: "force", data: rawChartData }],
              primaryAxis,
              secondaryAxes,
              dark: true,
            }}
          />
        </div>
        <div className="flex-1">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th className="w-1">ID</th>
                <th>Peaks</th>
              </tr>
            </thead>
            <tbody>
              {peaks.map((peak, index) => (
                <tr key={index}>
                  <th>{index}</th>
                  <td>{peak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;
