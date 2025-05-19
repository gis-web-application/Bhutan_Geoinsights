export const createPolarChart = (polarNode) => {
  const chartLabels = [
    "Male (%)",
    "Female (%)",
    "Children <5 (%)",
    "Elderly 65+ (%)"
  ];
  const polarChart = new Chart(polarNode, {
    type: "polarArea",
    data: {
      labels: chartLabels,
      datasets: [
        {
          data: [0, 0, 0, 0], // Initial values
          backgroundColor: [
            "#4285F4", // Male
            "#EA4335", // Female
            "#FBBC05", // Children
            "#34A853"  // Elderly
          ],
          borderColor: "#fff",
          borderWidth: 0.5,
          datalabels: {
            align: "start",
            anchor: "end",
            color: "#151515",
            display: false,
            formatter: (value) => value ? value.toFixed(1) + "%" : ""
          },
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      responsiveAnimationDuration: 0,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.formattedValue}%`;
            }
          }
        },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            display: true,
            callback: (val) => val,
            font: {
              size: 9,
            }
          },
          pointLabels: {
            display: true,
            centerPointLabels: true,
            font: {
              size: 12,
              fontFamily: "'TimeNew Roman', Times, serif"
            }
          },
          angleLines: {
            display: true,
            lineWidth: 0.75
          },
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  // Add methods for updating and clearing data
  polarChart.updateData = (dataArr) => {
    polarChart.data.datasets[0].data = dataArr;
    polarChart.update();
  };
  polarChart.clearData = () => {
    polarChart.data.datasets[0].data = [0, 0, 0, 0];
    polarChart.update();
  };

  return polarChart;
};