import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts';

export const Chart = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const chartOptions = {
            layout: { textColor: 'black', background: { type: ColorType.Solid, color: 'white' } }
        };
        const chart = createChart(containerRef.current, chartOptions);
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350'
        });

        const data = [
            { open: 10, high: 10.63, low: 9.49, close: 9.55, time: '2022-01-17' },
            { open: 9.55, high: 10.30, low: 9.42, close: 9.94, time: '2022-01-18' },
            { open: 9.94, high: 10.17, low: 9.92, close: 9.78, time: '2022-01-19' },
            { open: 9.78, high: 10.59, low: 9.18, close: 9.51, time: '2022-01-20' },
            { open: 9.51, high: 10.46, low: 9.10, close: 10.17, time: '2022-01-21' },
            { open: 10.17, high: 10.96, low: 10.16, close: 10.47, time: '2022-01-24' },
            { open: 10.47, high: 11.39, low: 10.40, close: 10.81, time: '2022-01-25' },
            { open: 10.81, high: 11.60, low: 10.30, close: 10.75, time: '2022-01-26' },
            { open: 10.75, high: 11.60, low: 10.49, close: 10.93, time: '2022-01-27' },
            { open: 10.93, high: 11.53, low: 10.76, close: 10.96, time: '2022-01-28' }
        ];

        candlestickSeries.setData(data);
        chart.timeScale().fitContent();

        return () => chart.remove();
    }, []);

    return <div ref={containerRef} style={{ width: '100%', height: '500px' }} />;
};