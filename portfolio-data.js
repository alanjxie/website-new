/* Fill content, links and attachments here without changing the detail layout.
   body supports strings or blocks: { type: 'text'|'image'|'video'|'code', text, url, alt }.
   links: [{ label, url }]; attachments: [{ title, type, url }] (three slots). */
window.PortfolioData = {
  projects: [
    {
      id: 'sdr', title: 'SDR Signal Analysis and Demodulation', category: 'Signal processing',
      summary: '',
      body: ['In this project I implemented an FM demodulation chain. Using the Blog V4 RTL-SDR and its standard library, I received IQ samples from the air through sampling. I wrote a BP filter block with windowing inside to account for real world sampling schemes. I used other libraries such as numpy, scipy, matplotlib, and sounddevice to mathematically compute and visually showcase results.'],
      links: [{ label: 'GitHub', url: 'https://github.com/alanjxie/RTL-SDR-FM-Demodulator' }],
      showAttachments: false,
      attachments: [],
    },
    { id: 'fpga', title: 'DMA-to-FFT FPGA Spectrum Analyzer', category: 'Digital hardware', summary: '', body: [], links: [], attachments: [{}, {}, {}] },
    { id: 'rf', title: 'E2E RF Frontend System', category: 'RF Systems', summary: '', body: [], links: [], attachments: [{}, {}, {}] },
  ],
  experiences: [
    {
      id: 'gtri', organization: 'GTRI-ICL', role: 'Electrical Engineering Intern',
      description: 'Focusing on 5G and wireless communication.',
      summary: '', body: [], links: [], attachments: [{}, {}, {}],
    },
  ],
};
