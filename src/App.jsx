import React, { useLayoutEffect, useRef } from 'react';
import { proxy, useSnapshot } from 'valtio';
import Chart from 'chart.js/auto';
import * as bootstrap from 'bootstrap'

const EPSILON = 0.01;

const state = proxy({
  loanAmount: '500000',
  interest: '6.09',
  loanTerm: '0',
  extraMonthlyPayment: '0',
  error: null,
  results: {
    monthlyPayment: null,
    totalPaid: null,
    totalYears: null,
    tableData: null,
  },
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'AUD',
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
          label: ({ dataset, raw }) => {
            return ` ${dataset.label} - $${raw.toFixed(2)}`;
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

function handleAmountChange({ target }) {
  state.loanAmount = target.value;
}

function handleTermChange({ target }) {
  state.loanTerm = target.value;
}

function handleInterestChange({ target }) {
  state.interest = target.value;
}

function handleExtraMonthlyPaymentChange({ target }) {
  state.extraMonthlyPayment = target.value;
}

function calculate(loanAmount, interest, loanTerm, extraPrincipal = 0) {
  const termYears = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  const termMonths = termYears[loanTerm] * 12;

  // Amortization for monthly payments
  // Loan amount * [(i * (1 + i)²) / ((1 + i)² - 1)]

  const i = interest / 12;
  const a = i * Math.pow(1 + i, termMonths);
  const b = Math.pow(1 + i, termMonths) - 1;
  const monthlyPayment = (loanAmount * a) / b;

  let principal = loanAmount;
  let totalPaid = 0;

  const payments = [];

  while (principal > EPSILON) {
    const monthlyPayments = [];

    for (let j = 0; j < 12; j++) {
      let interestPayment = (principal * interest) / 12;
      let principalPayment = monthlyPayment + extraPrincipal - interestPayment;

      if (principal <= principalPayment) {
        principalPayment = principal;
      }

      principal -= principalPayment;
      totalPaid += interestPayment + principalPayment;

      if (principal <= EPSILON) {
        principal = 0;
      }

      monthlyPayments.push({
        interestPayment,
        principalPayment,
        principal,
        totalPaid,
      });

      if (principal <= EPSILON) {
        break;
      }
    }
    if (monthlyPayments.length > 0) {
      payments.push(monthlyPayments);
    }
  }

  const chartData = {
    labels: payments.map((_, index) => index + 1),
    datasets: [
      { label: 'Interest', data: [] },
      { label: 'Principal', data: [] },
    ],
  };
  const tableData = [];

  payments.forEach((monthlyPayments) => {
    let yearInterest = 0;
    let yearPrincipal = 0;

    monthlyPayments.forEach((payment) => {
      yearInterest += payment.interestPayment;
      yearPrincipal += payment.principalPayment;
    });

    chartData.datasets[0].data.push(yearInterest / monthlyPayments.length);
    chartData.datasets[1].data.push(yearPrincipal / monthlyPayments.length);

    const lastPrincipal =
      monthlyPayments[monthlyPayments.length - 1]?.principal ?? 0;

    tableData.push({
      interest: currencyFormatter.format(Math.round(yearInterest)),
      principal: currencyFormatter.format(Math.round(yearPrincipal)),
      principalBalance: currencyFormatter.format(Math.round(lastPrincipal)),
    });
  });

  return {
    monthlyPayment: currencyFormatter.format(Math.round(monthlyPayment)),
    totalPaid: currencyFormatter.format(Math.round(totalPaid)),
    totalYears: payments.length,
    chartData,
    tableData,
  };
}

export const App = () => {
  // Since the snapshot state will be used for inputs, the sync option needs to
  // be used to prevent the cursor from jumping around.
  // https://github.com/pmndrs/valtio/issues/132
  const snap = useSnapshot(state, { sync: true });
  const canvasRef = useRef();
  const chartRef = useRef();

  const handleSubmit = (event) => {
    event?.preventDefault();

    const loanAmount = Number(state.loanAmount);
    const interest = Number(state.interest) * 0.01;
    const extraMonthlyPayment = Number(state.extraMonthlyPayment);

    if (isNaN(loanAmount) || !loanAmount) {
      state.error = 'Loan amount is invalid';
    } else if (isNaN(interest) || !interest) {
      state.error = 'Interest is invalid';
    } else if (isNaN(extraMonthlyPayment) || extraMonthlyPayment < 0) {
      state.error = 'Extra monthly payment is invalid';
    } else {
      state.error = '';
      const { monthlyPayment, totalPaid, totalYears, chartData, tableData } =
        calculate(loanAmount, interest, state.loanTerm, extraMonthlyPayment);

      state.results.monthlyPayment = monthlyPayment;
      state.results.totalPaid = totalPaid;
      state.results.totalYears = totalYears;
      state.results.tableData = tableData;

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
		<main class="my-3">
			<section class="py-5">
				<div class="container">
					<div class="row">
						<div class="col-lg-12">
							<h1 class="h5 text-center pb-2 mb-4">Mortgage Calculator</h1>
						</div>
					</div>
					<div class="row gy-4">
						<div class="col-lg-4">
							<div class="card p-4">
								<form onSubmit={handleSubmit}>
									<div class="row gx-3 gy-3">
										<div class="col-md-8">
											<div class="form-group">
												<label class="form-label small mb-1">Loan amount</label>
												<div class="position-relative d-flex align-items-center">
													<span class="position-absolute small ms-2 ps-1">$</span>
													<input
														type="text"
														class="form-control-sm border-1 border-grey mw-100 w-100 ps-4"
														value={snap.loanAmount}
														onChange={handleAmountChange}
													/>
												</div>
											</div>
										</div>
										<div class="col-md-4">
											<div class="form-group">
												<label class="form-label small mb-1">Interest</label>
												<div class="position-relative d-flex align-items-center">
													<span class="position-absolute small end-0 me-2 pe-1">%</span>
													<input
														type="text"
														class="form-control-sm border-1 border-grey mw-100 w-100 pe-4"
														value={snap.interest}
														onChange={handleInterestChange}
													/>
												</div>
											</div>
										</div>
										<div class="col-12">
											<div class="form-group">
												<label class="form-label small mb-1">Loan term</label>
												<div>
													<select
														class="form-control-sm border-1 border-grey mw-100 w-100"
														value={snap.loanTerm}
														onChange={handleTermChange}
													>
														<option value="29">30 years</option>
														<option value="28">29 years</option>
														<option value="27">28 years</option>
														<option value="26">27 years</option>
														<option value="25">26 years</option>
														<option value="24">25 years</option>
														<option value="23">24 years</option>
														<option value="22">23 years</option>
														<option value="21">22 years</option>
														<option value="20">21 years</option>
														<option value="19">20 years</option>
														<option value="18">19 years</option>
														<option value="17">18 years</option>
														<option value="16">17 years</option>
														<option value="15">16 years</option>
														<option value="14">15 years</option>
														<option value="13">14 years</option>
														<option value="12">13 years</option>
														<option value="11">12 years</option>
														<option value="10">11 years</option>
														<option value="9">10 years</option>
														<option value="8">9 years</option>
														<option value="7">8 years</option>
														<option value="6">7 years</option>
														<option value="5">6 years</option>
														<option value="4">5 years</option>
														<option value="3">4 years</option>
														<option value="2">3 years</option>
														<option value="1">2 years</option>
														<option value="0">1 year</option>
													</select>

												</div>
											</div>
										</div>
										<div class="col-12">
											<div class="form-group">
												<label class="form-label small mb-1">Extra monthly payment</label>
												<div class="position-relative d-flex align-items-center">
													<span class="position-absolute small ms-2 ps-1">$</span>
													<input
														type="text"
														class="form-control-sm border-1 border-grey mw-100 w-100 ps-4"
														value={snap.extraMonthlyPayment}
														onChange={handleExtraMonthlyPaymentChange}
													/>
												</div>
											</div>
										</div>
										{snap.error && (
											<div class="col-12">
												<div class="text-warning">{snap.error}</div>
											</div>
										)}
										<div class="col-12">
											<button
												class="btn btn-primary w-100"
												type="submit"
											>
												Calculate
											</button>
										</div>
									</div>
								</form>
							</div>
						</div>
						<div class="col-lg-8">
							<div class="row gy-4">
								<div class="col-md-4">
									<div class="card text-center p-4">
										<div class="small">Monthly payment</div>
										<div class="fw-semibold">{snap.results.monthlyPayment}</div>
									</div>
								</div>
								<div class="col-md-4">
									<div class="card text-center p-4">
										<div class="small">Total paid</div>
										<div class="fw-semibold">{snap.results.totalPaid}</div>
									</div>
								</div>
								<div class="col-md-4">
									<div class="card text-center p-4">
										<div class="small">Total years</div>
										<div class="fw-semibold">{snap.results.totalYears}</div>
									</div>
								</div>
								<div class="col-12">
									<div class="card p-4">
										<canvas
											ref={canvasRef}
											width="800"
											height="400"
											class="max-w-full"
										/>
									</div>
								</div>
								<div class="col-12">
									<div class="card p-4">
										<div class="overflow-auto mw-100">
											<table class="table table-bordered mb-0">
												<thead>
													<tr>
														<th class="fw-semibold">Year</th>
														<th class="fw-semibold">Interest</th>
														<th class="fw-semibold">Principal</th>
														<th class="fw-semibold">Ending balance</th>
													</tr>
												</thead>
												<tbody>
													{snap.results.tableData?.map(
														({ interest, principal, principalBalance }, index) => (
															<tr key={index}>
																<td>{index + 1}</td>
																<td>{interest}</td>
																<td>{principal}</td>
																<td>{principalBalance}</td>
															</tr>
														)
													)}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</main>
  );
};
