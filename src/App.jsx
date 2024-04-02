import React, { useLayoutEffect, useRef } from 'react';
import { proxy, useSnapshot } from 'valtio';
import Chart from 'chart.js/auto';

const state = proxy({
  loanAmount: '300000',
  interest: '7',
  loanTerm: '0',
  error: null,
  results: {
    monthlyPayment: null,
    totalPaid: null,
  },
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const chartConfig = {
  type: 'bar',
  options: {
    plugins: {
      title: {
        display: true,
        text: 'Average Monthly Payment Ratio',
      },
      tooltip: {
        callbacks: {
          title: ([value]) => {
            return `Year ${value.label}`;
          },
          label: ({ raw }) => {
            return ` $${raw.toFixed(2)}`;
          },
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Year',
        },
      },
      y: {
        stacked: true,
        ticks: {
          callback: (value) => {
            return `$${value}`;
          },
        },
      },
    },
  },
};

function handleAmountChange(event) {
  state.loanAmount = event.target.value;
}

function handleTermChange(event) {
  state.loanTerm = event.target.value;
}

function handleInterestChange(event) {
  state.interest = event.target.value;
}

function calculate(loanAmount, interest, loanTerm) {
  const termYears = { 0: 30, 1: 15 }[loanTerm];
  const termMonths = termYears * 12;

  // Amortization for monthly payments
  // Loan amount * [(i * (1 + i)²) / ((1 + i)² - 1)]

  const i = interest / 12;
  const a = i * Math.pow(1 + i, termMonths);
  const b = Math.pow(1 + i, termMonths) - 1;
  const monthlyPayment = (loanAmount * a) / b;

  // Calculate the different amounts paid towards principal and interest for
  // each month.
  let principal = loanAmount;
  let totalPaid = 0;

  const chartData = {
    labels: [...Array(termYears)].map((_, index) => index + 1),
    datasets: [
      { label: 'Interest', data: [] },
      { label: 'Principal', data: [] },
    ],
  };

  for (let i = 0; i < termYears; i++) {
    let interestPayments = 0;
    let principalPayments = 0;

    for (let j = 0; j < 12; j++) {
      const interestPayment = (principal * interest) / 12;
      const principalPayment = monthlyPayment - interestPayment;

      principal -= principalPayment;
      totalPaid += interestPayment + principalPayment;

      interestPayments += interestPayment;
      principalPayments += principalPayment;
    }
    const averageInterestPayment = interestPayments / 12;
    const averagePrincipalPayment = principalPayments / 12;

    chartData.datasets[0].data.push(averageInterestPayment);
    chartData.datasets[1].data.push(averagePrincipalPayment);
  }

  return {
    monthlyPayment: currencyFormatter.format(Math.round(monthlyPayment)),
    totalPaid: currencyFormatter.format(Math.round(totalPaid)),
    chartData,
  };
}

export const App = () => {
  const snap = useSnapshot(state);
  const canvasRef = useRef();
  const chartRef = useRef();

  const handleSubmit = (event) => {
    event?.preventDefault();

    const loanAmount = Number(state.loanAmount);
    const interest = Number(state.interest) * 0.01;

    if (isNaN(loanAmount)) {
      state.error = 'Loan amount is invalid';
    } else if (isNaN(interest)) {
      state.error = 'Interest is invalid';
    } else {
      state.error = '';
      const { monthlyPayment, totalPaid, chartData } = calculate(
        loanAmount,
        interest,
        state.loanTerm
      );

      state.results.monthlyPayment = monthlyPayment;
      state.results.totalPaid = totalPaid;

      if (!chartRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const chart = new Chart(ctx, {
          ...chartConfig,
          data: chartData,
        });
        chartRef.current = chart;
      } else {
        const chart = chartRef.current;
        chart.data = chartData;
        chart.update();
      }
    }
  };

  useLayoutEffect(handleSubmit, []);

  return (
    <div className="p-8 lg:p-16">
      <div className="text-zinc-400 text-xl mb-8 text-center">
        Mortgage Calculator
      </div>
      <div className="flex justify-center">
        <div className="flex flex-col lg:flex-row justify-center gap-8 max-w-[1400px]">
          <div className="flex flex-col gap-8 flex-1 h-fit">
            <form className="p-8 __border rounded" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2 text-sm mb-8">
                <div className="flex gap-4">
                  <div className="flex flex-col flex-[3]">
                    <label className="text-zinc-400">Loan amount</label>
                    <div className="relative">
                      <div className="absolute left-1 top-[5px]">$</div>
                      <input
                        type="text"
                        className="bg-zinc-900 __border rounded pl-4 pr-2 py-1 w-full"
                        value={snap.loanAmount}
                        onChange={handleAmountChange}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="text-zinc-400">Interest</label>
                    <div className="relative">
                      <div className="absolute right-1 top-[5px]">%</div>
                      <input
                        type="text"
                        className="bg-zinc-900 __border rounded pr-4 pl-2 py-1 w-full"
                        value={snap.interest}
                        onChange={handleInterestChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-zinc-400">Loan term</label>
                  <select
                    className="bg-zinc-900 __border rounded px-2 py-1 w-full"
                    value={snap.loanTerm}
                    onChange={handleTermChange}
                  >
                    <option value="0">30 year fixed</option>
                    <option value="1">15 year fixed</option>
                  </select>
                </div>
                {snap.error && (
                  <div className="text-red-400 mt-2">
                    Loan amount is invalid
                  </div>
                )}
              </div>
              <button
                className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded p-2 hover:opacity-60 transition-opacity w-full text-lg"
                type="submit"
              >
                Calculate
              </button>
            </form>
          </div>
          <div className="flex flex-col gap-8 flex-[2]">
            <div className="p-8 __border rounded">
              <canvas
                ref={canvasRef}
                width="800"
                height="400"
                className="max-w-full"
              />
            </div>
            <div className="flex gap-4">
              <div>
                <div className="text-sm">Monthly payment</div>
                <div className="text-lg font-bold">
                  {snap.results.monthlyPayment}
                </div>
              </div>
              <div>
                <div className="text-sm">Total paid</div>
                <div className="text-lg font-bold">
                  {snap.results.totalPaid}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
