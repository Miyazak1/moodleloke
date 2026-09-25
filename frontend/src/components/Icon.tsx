type IconProps = {
  name: string;
  color?: string;
  className?: string;
};

const ICON_PATHS: Record<string, string[]> = {
  'lucide:arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
  'lucide:calendar-range': ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2', 'M7 15h4', 'M14 15h3', 'M7 18h2', 'M12 18h5'],
  'lucide:circle-check-big': ['M21.8 10A10 10 0 1 1 17 3.3', 'm9 11 3 3L22 4'],
  'lucide:history': ['M3 12a9 9 0 1 0 3-6.7', 'M3 3v6h6', 'M12 7v5l3 2'],
  'lucide:radio': ['M16.2 7.8a6 6 0 0 1 0 8.4', 'M7.8 16.2a6 6 0 0 1 0-8.4', 'M19 5a10 10 0 0 1 0 14', 'M5 19A10 10 0 0 1 5 5', 'M12 12h.01'],
  'lucide:search-x': ['M21 21l-4.3-4.3', 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16', 'm8 8 6 6', 'm14 8-6 6'],
  'lucide:toggle-left': ['M8 5h8a7 7 0 0 1 0 14H8A7 7 0 0 1 8 5', 'M8 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  'lucide:triangle-alert': ['M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3l-8.5-15a2 2 0 0 0-3.5 0z', 'M12 9v4', 'M12 17h.01'],
  'lucide:book-open-check': ['M12 7v14', 'M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 18.5z', 'M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 1 2.5-2.5z', 'm16 13 1.6 1.6L21 11.2'],
  'lucide:chevron-down': ['m6 9 6 6 6-6'],
  'lucide:chevron-up': ['m18 15-6-6-6 6'],
  'lucide:chevron-right': ['m9 18 6-6-6-6'],
  'lucide:check': ['M20 6 9 17l-5-5'],
  'lucide:check-check': ['M18 6 7 17l-5-5', 'M22 10l-7.5 7.5L13 16'],
  'lucide:clock-3': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 6v6h4'],
  'lucide:clipboard-check': ['M9 5h6', 'M9 3h6v4H9z', 'M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', 'm9 14 2 2 4-5'],
  'lucide:compass': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'm16.2 7.8-2.8 6.6-6.6 2.8 2.8-6.6z'],
  'lucide:file-pen-line': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M10 18l4.8-4.8a1.7 1.7 0 0 1 2.4 2.4L12.4 20H10z'],
  'lucide:home': ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9 21v-7h6v7'],
  'lucide:inbox': ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 4h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z'],
  'lucide:hard-drive': ['M22 12H2', 'M5.5 4h13a2 2 0 0 1 1.8 1.1L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l1.7-6.9A2 2 0 0 1 5.5 4', 'M6 16h.01', 'M10 16h.01'],
  'lucide:filter': ['M22 3H2l8 9.5V20l4 2v-9.5z'],
  'lucide:globe-2': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 0 20', 'M12 2a15.3 15.3 0 0 0 0 20'],
  'lucide:graduation-cap': ['M22 10 12 4 2 10l10 6z', 'M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5'],
  'lucide:landmark': ['M3 22h18', 'M6 18v-7', 'M10 18v-7', 'M14 18v-7', 'M18 18v-7', 'M12 2 3 7v2h18V7z'],
  'lucide:layers': ['M12 2 2 7l10 5 10-5z', 'M2 12l10 5 10-5', 'M2 17l10 5 10-5'],
  'lucide:layers-3': ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  'lucide:languages': ['M5 8h7', 'M9 4v4', 'M4 4h10', 'M6 12c2.5-1 4.5-3.2 5.5-6', 'M13 20l4-9 4 9', 'm14.5 17h5'],
  'lucide:link': ['M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1', 'M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1'],
  'lucide:layout-dashboard': ['M3 3h8v8H3z', 'M13 3h8v5h-8z', 'M13 10h8v11h-8z', 'M3 13h8v8H3z'],
  'lucide:layout-list': ['M3 5h18', 'M3 12h18', 'M3 19h18', 'M7 5v14'],
  'lucide:list-checks': ['m3 7 1.5 1.5L7 6', 'M10 7h11', 'm3 14 1.5 1.5L7 13', 'M10 14h11'],
  'lucide:list-tree': ['M6 3v12', 'M6 7h6', 'M6 11h10', 'M6 15h14', 'M3 3h3', 'M3 15h3'],
  'lucide:log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  'lucide:mail': ['M4 4h16v16H4z', 'm4 7 4 4 4-4'],
  'lucide:map': ['M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z', 'M9 3v15', 'M15 6v15'],
  'lucide:map-pin': ['M20 10c0 4.5-8 12-8 12S4 14.5 4 10a8 8 0 1 1 16 0', 'M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4'],
  'lucide:messages-square': ['M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 13h5'],
  'lucide:medal': ['M7.2 8.4 3 2h6l3 4 3-4h6l-4.2 6.4', 'M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12', 'm14.5 14.5-3.5 3.5-1.5-1.5'],
  'lucide:notebook-pen': ['M2 6h4', 'M2 10h4', 'M2 14h4', 'M2 18h4', 'M6 3h13a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z', 'm13 15 4.5-4.5a1.4 1.4 0 0 1 2 2L15 17h-2z'],
  'lucide:key-round': ['M2 18a6 6 0 1 0 8.5-5.5L22 1', 'M14 6l3 3', 'M18 2l4 4'],
  'lucide:pause': ['M8 5v14', 'M16 5v14'],
  'lucide:pencil': ['M14.5 4.5a2.1 2.1 0 0 1 3 3L8 17l-4 1 1-4z', 'M13 6l5 5'],
  'lucide:pencil-line': ['M4 20h16', 'M14.5 4.5a2.1 2.1 0 0 1 3 3L8 17l-4 1 1-4z'],
  'lucide:play': ['M6 4v16l14-8z'],
  'lucide:plus': ['M12 5v14', 'M5 12h14'],
  'lucide:minus': ['M5 12h14'],
  'lucide:badge-dollar-sign': ['M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.75', 'M12 7v10', 'M15 9.5c-.5-.8-1.5-1.2-3-1.2-1.7 0-2.7.8-2.7 1.9 0 1.2 1.1 1.8 2.7 2 1.8.2 2.8.8 2.8 2 0 1.1-1 1.9-2.8 1.9-1.5 0-2.5-.4-3-1.2'],
  'lucide:bookmark': ['M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  'lucide:braces': ['M8 3c-2 0-3 1-3 3v3c0 1-1 2-2 2 1 0 2 1 2 2v3c0 2 1 3 3 3', 'M16 3c2 0 3 1 3 3v3c0 1 1 2 2 2-1 0-2 1-2 2v3c0 2-1 3-3 3'],
  'lucide:building-2': ['M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18', 'M6 12H4a2 2 0 0 0-2 2v8h20v-8a2 2 0 0 0-2-2h-2', 'M10 6h4', 'M10 10h4', 'M10 14h4', 'M10 18h4'],
  'lucide:buildings': ['M4 21V7a2 2 0 0 1 2-2h6v16', 'M12 9h6a2 2 0 0 1 2 2v10', 'M8 9h.01', 'M8 13h.01', 'M8 17h.01', 'M16 13h.01', 'M16 17h.01'],
  'lucide:calendar-check': ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2', 'm8 15 2 2 4-5'],
  'lucide:calendar-clock': ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2', 'M12 14v3h2'],
  'lucide:calendar-days': ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'],
  'lucide:calculator': ['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2', 'M8 6h8', 'M8 10h.01', 'M12 10h.01', 'M16 10h.01', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'],
  'lucide:check-square': ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2', 'm8 12 2 2 5-6'],
  'lucide:circle-alert': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 8v5', 'M12 17h.01'],
  'lucide:circle-dot': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 12h.01'],
  'lucide:clipboard-list': ['M9 5h6', 'M9 3h6v4H9z', 'M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', 'M8 12h.01', 'M11 12h5', 'M8 16h.01', 'M11 16h5'],
  'lucide:clock': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 6v6l4 2'],
  'lucide:cloud-sun': ['M12 2v2', 'm4.2 1.8-1.4 1.4', 'M20 10h-2', 'M17.7 7.7A5 5 0 0 0 9.1 10', 'M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.7A4 4 0 0 0 7 18'],
  'lucide:database': ['M4 6c0 2.2 3.6 4 8 4s8-1.8 8-4-3.6-4-8-4-8 1.8-8 4', 'M4 6v6c0 2.2 3.6 4 8 4s8-1.8 8-4V6', 'M4 12v6c0 2.2 3.6 4 8 4s8-1.8 8-4v-6'],
  'lucide:download': ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  'lucide:droplets': ['M7 16c0 2.2 1.8 4 4 4s4-1.8 4-4c0-2.7-4-7-4-7s-4 4.3-4 7', 'M17 8c0 1.7 1.3 3 3 3s3-1.3 3-3c0-2-3-5-3-5s-3 3-3 5'],
  'lucide:eye': ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  'lucide:eye-off': ['M3 3l18 18', 'M10.6 10.6a2 2 0 0 0 2.8 2.8', 'M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a17.2 17.2 0 0 1-3.1 4.3', 'M6.1 6.1C3.5 7.9 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 4.2-.8'],
  'lucide:eraser': ['m7 21-4-4a2 2 0 0 1 0-3L13.5 3.5a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3L10 21z', 'M5 12l7 7', 'M10 21h11'],
  'lucide:file-check-2': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'm8 13 2 2 4-5'],
  'lucide:file-up': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M12 18v-6', 'm9 15 3-3 3 3'],
  'lucide:files': ['M15 2H6a2 2 0 0 0-2 2v12', 'M8 6h9a2 2 0 0 1 2 2v14H8z'],
  'lucide:flame': ['M12 22c4 0 7-3 7-7 0-4-3-6-5-9-.5 2-2 3-4 4 0-3-2-5-2-8-3 3-5 7-5 11 0 4 3 7 7 7z'],
  'lucide:function-square': ['M3 3h18v18H3z', 'M9 17c1.4 0 2-1 2-2.4V9.5C11 7.6 12 7 13.5 7', 'M8 11h6'],
  'lucide:gauge': ['M12 15l3-3', 'M3.3 18a9 9 0 1 1 17.4 0', 'M7 14h.01', 'M17 14h.01', 'M12 10h.01'],
  'lucide:book-open': ['M12 7v14', 'M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 18.5z', 'M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 1 2.5-2.5z'],
  'lucide:file-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5'],
  'lucide:sigma': ['M18 7V4H6l6 8-6 8h12v-3'],
  'lucide:atom': ['M12 12h.01', 'M20.2 20.2c2.04-2.03-.03-7.4-4.63-12S5.6 1.3 3.56 3.35c-2.03 2.04.03 7.4 4.63 12s9.97 6.9 12.01 4.85', 'M15.57 15.57c4.6-4.6 6.66-9.97 4.63-12-2.04-2.05-7.4.03-12 4.63s-6.67 9.96-4.64 12c2.04 2.04 7.41-.03 12.01-4.63'],
  'lucide:flask-conical': ['M10 2v7.3L4.4 19a2 2 0 0 0 1.7 3h11.8a2 2 0 0 0 1.7-3L14 9.3V2', 'M8.5 2h7', 'M7 16h10'],
  'lucide:activity': ['M22 12h-4l-3 9L9 3l-3 9H2'],
  'lucide:arrow-left': ['M19 12H5', 'm12 19-7-7 7-7'],
  'lucide:arrow-left-right': ['M8 3 4 7l4 4', 'M4 7h16', 'm16 21 4-4-4-4', 'M20 17H4'],
  'lucide:arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  'lucide:arrow-up': ['M12 19V5', 'm5 12 7-7 7 7'],
  'lucide:arrow-up-right': ['M7 7h10v10', 'M7 17 17 7'],
  'lucide:bar-chart-3': ['M3 3v18h18', 'M7 16v-5', 'M12 16V7', 'M17 16v-3'],
  'lucide:chart-no-axes-combined': ['M12 16v5', 'M16 14v7', 'M20 10v11', 'M4 18v3', 'M8 12v9'],
  'lucide:chart-no-axes-column-increasing': ['M6 20V10', 'M12 20V6', 'M18 20v-8', 'm15 15 3-3 3 3'],
  'lucide:check-circle-2': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'm9 12 2 2 4-5'],
  'lucide:badge-check': ['M3.9 8.6a4 4 0 0 1 4.7-4.7 4 4 0 0 1 6.8 0 4 4 0 0 1 4.7 4.7 4 4 0 0 1 0 6.8 4 4 0 0 1-4.7 4.7 4 4 0 0 1-6.8 0 4 4 0 0 1-4.7-4.7 4 4 0 0 1 0-6.8', 'm9 12 2 2 4-4'],
  'lucide:badge-info': ['M3.9 8.6a4 4 0 0 1 4.7-4.7 4 4 0 0 1 6.8 0 4 4 0 0 1 4.7 4.7 4 4 0 0 1 0 6.8 4 4 0 0 1-4.7 4.7 4 4 0 0 1-6.8 0 4 4 0 0 1-4.7-4.7 4 4 0 0 1 0-6.8', 'M12 11v5', 'M12 8h.01'],
  'lucide:book-check': ['M12 7v14', 'M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 18.5z', 'M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 1 2.5-2.5z', 'm15 12 1.5 1.5 3-3'],
  'lucide:bot': ['M12 2v2', 'M8 4h8', 'M5 8h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3', 'M9 13h.01', 'M15 13h.01', 'M8 17h8'],
  'lucide:brain': ['M9.5 4A3.5 3.5 0 0 0 6 7.5v.2A3.5 3.5 0 0 0 4 14a3.5 3.5 0 0 0 3.5 3.5H9', 'M14.5 4A3.5 3.5 0 0 1 18 7.5v.2a3.5 3.5 0 0 1 2 6.3 3.5 3.5 0 0 1-3.5 3.5H15', 'M9 4v16', 'M15 4v16', 'M9 9H7', 'M15 9h2', 'M9 15H7', 'M15 15h2'],
  'lucide:circle-check': ['M22 11.1V12a10 10 0 1 1-5.9-9.1', 'm9 11 3 3L22 4'],
  'lucide:circle-x': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'm15 9-6 6', 'm9 9 6 6'],
  'lucide:external-link': ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  'lucide:file-question': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9.5 13a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.1-1.5 2', 'M12 19h.01'],
  'lucide:file-search': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7', 'M14 2v6h6', 'M11 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'm14 18 3 3'],
  'lucide:image': ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'm3 16 5-5 4 4 3-3 6 6', 'M15 8h.01'],
  'lucide:info': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 11v5', 'M12 8h.01'],
  'lucide:library': ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M4 4v15.5', 'M8 4h12v13H8z', 'M12 8h4'],
  'lucide:loader-circle': ['M21 12a9 9 0 1 1-6.2-8.6'],
  'lucide:lock-keyhole': ['M7 10V7a5 5 0 0 1 10 0v3', 'M5 10h14v11H5z', 'M12 14v3'],
  'lucide:message-square-text': ['M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M7 8h10', 'M7 12h7'],
  'lucide:paperclip': ['m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9'],
  'lucide:scan-check': ['M4 7V5a2 2 0 0 1 2-2h2', 'M16 3h2a2 2 0 0 1 2 2v2', 'M20 17v2a2 2 0 0 1-2 2h-2', 'M8 21H6a2 2 0 0 1-2-2v-2', 'm9 12 2 2 4-5'],
  'lucide:receipt-text': ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2z', 'M8 7h8', 'M8 11h8', 'M8 15h5'],
  'lucide:radar': ['M19.1 4.9A10 10 0 1 1 4.9 19.1', 'M12 12l7-7', 'M9.2 9.2a4 4 0 1 0 5.6 5.6', 'M6.4 6.4a8 8 0 1 0 11.2 11.2'],
  'lucide:refresh-cw': ['M21 12a9 9 0 0 0-15.3-6.3L3 8', 'M3 3v5h5', 'M3 12a9 9 0 0 0 15.3 6.3L21 16', 'M16 16h5v5'],
  'lucide:rotate-ccw': ['M3 12a9 9 0 1 0 3-6.7', 'M3 3v6h6'],
  'lucide:rotate-cw': ['M21 12a9 9 0 1 1-3-6.7', 'M21 3v6h-6'],
  'lucide:route': ['M4 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M20 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M7 8h6a3 3 0 0 1 0 6h-2a3 3 0 0 0 0 6h6'],
  'lucide:scan-line': ['M4 7V5a2 2 0 0 1 2-2h2', 'M16 3h2a2 2 0 0 1 2 2v2', 'M20 17v2a2 2 0 0 1-2 2h-2', 'M8 21H6a2 2 0 0 1-2-2v-2', 'M4 12h16'],
  'lucide:scan-search': ['M4 7V5a2 2 0 0 1 2-2h2', 'M16 3h2a2 2 0 0 1 2 2v2', 'M20 17v2a2 2 0 0 1-2 2h-2', 'M8 21H6a2 2 0 0 1-2-2v-2', 'M10 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0', 'm15 15 3 3'],
  'lucide:scale': ['M12 3v18', 'M5 7h14', 'M6 7l-4 8h8z', 'M18 7l-4 8h8z'],
  'lucide:school': ['M22 10 12 4 2 10l10 6z', 'M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5', 'M22 10v6'],
  'lucide:settings': ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M12 2v3', 'M12 19v3', 'M4.9 4.9l2.1 2.1', 'M17 17l2.1 2.1', 'M2 12h3', 'M19 12h3', 'M4.9 19.1 7 17', 'M17 7l2.1-2.1'],
  'lucide:settings-2': ['M20 7h-9', 'M7 7H4', 'M14 17H4', 'M20 17h-2', 'M8 5v4', 'M16 15v4'],
  'lucide:shapes': ['M4 4h7v7H4z', 'M15 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M6 17l3 5 3-5z'],
  'lucide:shield-alert': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10', 'M12 8v5', 'M12 17h.01'],
  'lucide:shield-check': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10', 'm9 12 2 2 4-5'],
  'lucide:share-2': ['M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M8.59 13.51l8.83 5.14', 'M17.41 5.49 8.59 10.49'],
  'lucide:shuffle': ['M16 3h5v5', 'M4 20l17-17', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  'lucide:shopping-cart': ['M6 6h15l-2 8H8z', 'M6 6 5 2H2', 'M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2', 'M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2'],
  'lucide:search': ['M21 21l-4.3-4.3', 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16'],
  'lucide:search-check': ['M21 21l-4.3-4.3', 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16', 'm8.5 11 1.8 1.8 3.2-4'],
  'lucide:send': ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4z'],
  'lucide:sparkles': ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M5 3v4', 'M3 5h4', 'M19 17v4', 'M17 19h4'],
  'lucide:test-tube-2': ['M21 7 15 1', 'M9 13 3 19a3 3 0 0 0 4 4l10-10', 'M14 2l8 8', 'M5 17h6'],
  'lucide:target': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4'],
  'lucide:thumbs-down': ['M17 14V2', 'M9 18.1 10 14H4.2a2 2 0 0 1-1.9-2.6l2.1-7A2 2 0 0 1 6.3 3H17v11h-3.9a2 2 0 0 0-2 1.5L10 20a2 2 0 0 1-3.5-1.9z', 'M17 2h2.7A2.3 2.3 0 0 1 22 4.3v7.4a2.3 2.3 0 0 1-2.3 2.3H17'],
  'lucide:thumbs-up': ['M7 10v12', 'M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.1 7A2 2 0 0 1 17.7 21H7V10h3.9a2 2 0 0 0 2-1.5L14 4a2 2 0 0 1 3.5 1.9z', 'M7 22H4.3A2.3 2.3 0 0 1 2 19.7v-7.4A2.3 2.3 0 0 1 4.3 10H7'],
  'lucide:timer': ['M10 2h4', 'M12 14v-4', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16', 'M18 6l2-2'],
  'lucide:timer-reset': ['M10 2h4', 'M12 14v-4', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0-6.3 3.1', 'M4 6v5h5', 'M18 6l2-2'],
  'lucide:train-front': ['M8 3h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4', 'M8 8h8', 'M8 15h.01', 'M16 15h.01', 'M8 19l-2 3', 'M16 19l2 3'],
  'lucide:trending-up': ['M3 17l6-6 4 4 8-8', 'M14 7h7v7'],
  'lucide:trophy': ['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0z', 'M5 5H3v2a4 4 0 0 0 4 4', 'M19 5h2v2a4 4 0 0 1-4 4'],
  'lucide:user-plus': ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M19 8v6', 'M22 11h-6'],
  'lucide:user-check': ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'm16 11 2 2 4-5'],
  'lucide:user-round': ['M18 20a6 6 0 0 0-12 0', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
  'lucide:wand-sparkles': ['M15 4V2', 'M15 16v-2', 'M8 9H6', 'M18 9h-2', 'M17.8 6.2l1.4-1.4', 'M10.8 13.2l-6.6 6.6a2 2 0 0 1-2.8-2.8l6.6-6.6', 'M8.5 10.5l3 3', 'M10.8 4.8 9.4 6.2', 'M19.2 13.2l-1.4-1.4'],
  'lucide:wrench': ['M14.7 6.3a4 4 0 0 0 5 5L11 20a2 2 0 0 1-3-3l8.7-8.7a4 4 0 0 0-5-5l-2 2 3 3z'],
  'lucide:archive': ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
  'lucide:book-plus': ['M12 7v14', 'M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 18.5z', 'M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 1 2.5-2.5z', 'M18 10v6', 'M15 13h6'],
  'lucide:copy-plus': ['M8 7H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2', 'M8 3h10a2 2 0 0 1 2 2v10', 'M15 10h6', 'M18 7v6'],
  'lucide:flag': ['M4 22V4', 'M4 4h11l1 4h5v10H10l-1-4H4'],
  'lucide:merge': ['M8 7h8a4 4 0 0 1 0 8h-6', 'M8 17h8a4 4 0 0 0 0-8h-6', 'm5 4 4 4-4 4', 'm5 12 4 4-4 4'],
  'lucide:save': ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2', 'M17 21v-8H7v8', 'M7 3v5h8'],
  'lucide:tag': ['M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8', 'M7.5 7.5h.01'],
  'lucide:x': ['M18 6 6 18', 'M6 6l12 12'],
  'lucide:zap': ['M13 2 3 14h7l-1 8 12-14h-7l1-6z'],
  'lucide:alert-triangle': ['M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3l-8.5-15a2 2 0 0 0-3.5 0z', 'M12 9v4', 'M12 17h.01'],
  'lucide:circle-help': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M9.1 9a3 3 0 1 1 5.8 1c0 2-2.9 2-2.9 4', 'M12 18h.01'],
  'lucide:file-json': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M10 12a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2', 'M14 12a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2'],
  'lucide:focus': ['M8 3H5a2 2 0 0 0-2 2v3', 'M16 3h3a2 2 0 0 1 2 2v3', 'M8 21H5a2 2 0 0 1-2-2v-3', 'M16 21h3a2 2 0 0 0 2-2v-3', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
  'lucide:infinity': ['M18.2 7c-2.4 0-4.3 2.2-6.2 5-1.9-2.8-3.8-5-6.2-5A5 5 0 0 0 6 17c2.4 0 4.3-2.2 6-5 1.9 2.8 3.8 5 6.2 5a5 5 0 0 0 0-10z'],
  'lucide:mail-warning': ['M4 4h16v10', 'M4 4v16h10', 'm4 7 4 4 4-4', 'M19 16v3', 'M19 22h.01'],
  'lucide:message-circle-question': ['M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z', 'M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.1-1.5 2', 'M12 16h.01'],
  'lucide:presentation': ['M2 3h20', 'M4 3v13h16V3', 'M8 21l4-5 4 5', 'm8 11 3-3 2 2 3-3'],
  'lucide:sliders-horizontal': ['M21 4h-7', 'M10 4H3', 'M21 12h-9', 'M8 12H3', 'M21 20h-5', 'M12 20H3', 'M14 2v4', 'M12 10v4', 'M16 18v4'],
  'lucide:square': ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2'],
  'lucide:undo-2': ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11']
};

function normalizeColor(color: string) {
  if (color === 'currentColor' || color.startsWith('var(')) return color;
  return color.startsWith('#') ? color : `#${color}`;
}

export function iconUrl(name: string, color = '243a32') {
  const stroke = normalizeColor(color).replace('#', '%23');
  const paths = ICON_PATHS[name] ?? ICON_PATHS['lucide:circle-help'];
  const body = paths.map((path) => `<path d="${path}" />`).join('');
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E${body}%3C/svg%3E`;
}

export function Icon({ name, color = '243a32', className }: IconProps) {
  const paths = ICON_PATHS[name] ?? ICON_PATHS['lucide:circle-help'];
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke={normalizeColor(color)}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}
