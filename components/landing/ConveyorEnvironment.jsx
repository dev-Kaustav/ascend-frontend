"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

const rollers = Array.from({ length: 12 }, (_, index) => 245 + index * 92);
const lowerRollers = Array.from({ length: 8 }, (_, index) => 516 + index * 92);

function Fastener({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="7" fill="#202522" stroke="#778078" strokeWidth="2" />
      <path d="M-3 0h6" stroke="#AAB1AA" strokeWidth="1.5" />
    </g>
  );
}

function Roller({ cx, cy, progress, reverse = false, disabled = false }) {
  const rotate = useTransform(
    progress,
    [0, 1],
    reverse ? [180, -540] : [0, 720]
  );

  return (
    <motion.g
      style={{
        rotate: disabled ? 0 : rotate,
        transformBox: "fill-box",
        transformOrigin: "center"
      }}
    >
      <ellipse cx={cx} cy={cy} rx="38" ry="19" fill="url(#roller-face)" stroke="#737C75" strokeWidth="2" />
      <ellipse cx={cx} cy={cy} rx="18" ry="9" fill="#0B0D0C" stroke="#A7AEA8" strokeOpacity=".65" />
      <path d={`M${cx - 12} ${cy}h24M${cx} ${cy - 6}v12`} stroke="#C8FF3D" strokeOpacity=".66" strokeWidth="2" />
    </motion.g>
  );
}

function Bottle({ x, y, tone = "#737B75" }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M19 0h22v19l8 10v70c0 10-8 18-18 18H29c-10 0-18-8-18-18V29l8-10V0Z" fill={tone} stroke="#D7DDD7" strokeOpacity=".48" strokeWidth="2" />
      <path d="M18 40h25v48H18Z" fill="#171B18" stroke="#C8FF3D" strokeOpacity=".5" />
      <path d="M24 50h13M24 59h13" stroke="#B9C1BA" strokeOpacity=".6" />
      <path d="M19 0h22v12H19Z" fill="#252B27" stroke="#B3BBB4" strokeOpacity=".65" />
    </g>
  );
}

function Carton({ x, y, width = 78, height = 106 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 14 13 0h${width - 26}l13 14v${height - 14}H0Z`} fill="url(#carton)" stroke="#C4CBC5" strokeOpacity=".58" strokeWidth="2" />
      <path d={`M13 1v13h${width - 26}V1M1 14h${width - 2}`} fill="none" stroke="#F4F1E8" strokeOpacity=".24" />
      <path d={`M12 35h${width - 24}v39H12Z`} fill="#101310" stroke="#C8FF3D" strokeOpacity=".45" />
      <path d={`M21 46h${width - 42}M21 56h${width - 50}`} stroke="#A7B0A9" strokeWidth="3" />
      <rect x={width - 23} y={height - 22} width="11" height="11" fill="#C8FF3D" />
    </g>
  );
}

function Pouch({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M8 0h61l8 96c1 12-8 22-20 22H20C8 118-1 108 0 96L8 0Z" fill="url(#pouch)" stroke="#D0D6D1" strokeOpacity=".55" strokeWidth="2" />
      <path d="M8 13h61M13 42h52v39H13Z" stroke="#C8FF3D" strokeOpacity=".48" fill="#111411" />
      <path d="M23 53h30M23 64h20" stroke="#AAB2AC" strokeWidth="3" />
    </g>
  );
}

function Crate({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 22 28 0h128l28 22v112H0Z" fill="#1A1F1B" stroke="#778079" strokeWidth="3" />
      <path d="M1 22h182M28 1v21M156 1v21" stroke="#D5DBD5" strokeOpacity=".28" />
      <path d="M18 43h148v68H18Z" fill="#0C0F0D" stroke="#4D554E" />
      {[33, 68, 103, 138].map((xPos) => (
        <path key={xPos} d={`M${xPos} 44v66`} stroke="#4A524B" strokeWidth="5" />
      ))}
      <path d="M38 74h108" stroke="#C8FF3D" strokeOpacity=".76" strokeWidth="3" />
      <text x="92" y="94" fill="#C8FF3D" fontFamily="var(--font-marketing-mono)" fontSize="12" textAnchor="middle">
        ASC / 04H
      </text>
    </g>
  );
}

export default function ConveyorEnvironment({ stageRef }) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ["start start", "end end"]
  });
  const x = useTransform(scrollYProgress, [0, 0.18, 0.78, 1], ["14%", "4%", "-12%", "-17%"]);
  const y = useTransform(scrollYProgress, [0, 0.25, 0.78, 1], ["7%", "2%", "13%", "17%"]);
  const scale = useTransform(scrollYProgress, [0, 0.18, 0.8, 1], [1.08, 0.96, 0.79, 0.75]);
  const opacity = useTransform(scrollYProgress, [0, 0.72, 0.94, 1], [1, 0.76, 0.36, 0]);
  const upperProductsX = useTransform(scrollYProgress, [0, 1], [0, 260]);
  const lowerCratesX = useTransform(scrollYProgress, [0, 1], [0, 190]);
  const scannerY = useTransform(scrollYProgress, [0, 0.5, 1], [0, 66, 0]);
  const scannerOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 0.3]);

  return (
    <motion.div
      className="conveyor-environment"
      style={reduceMotion ? { x: "1%", y: "5%", scale: 0.9, opacity: 0.72 } : { x, y, scale, opacity }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1600 1050" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#9AA29B" />
            <stop offset=".18" stopColor="#343A35" />
            <stop offset=".52" stopColor="#101311" />
            <stop offset=".82" stopColor="#4D554F" />
            <stop offset="1" stopColor="#151916" />
          </linearGradient>
          <linearGradient id="steel-edge" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#7E8780" />
            <stop offset=".45" stopColor="#202521" />
            <stop offset="1" stopColor="#090B09" />
          </linearGradient>
          <linearGradient id="roller-face" x1="0" x2="1">
            <stop stopColor="#252A26" />
            <stop offset=".45" stopColor="#8C958E" />
            <stop offset=".68" stopColor="#303631" />
            <stop offset="1" stopColor="#121512" />
          </linearGradient>
          <linearGradient id="carton" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#858E86" />
            <stop offset=".48" stopColor="#3E453F" />
            <stop offset="1" stopColor="#1B201C" />
          </linearGradient>
          <linearGradient id="pouch" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#B3BAB4" />
            <stop offset=".25" stopColor="#4B534D" />
            <stop offset=".7" stopColor="#242925" />
            <stop offset="1" stopColor="#727A73" />
          </linearGradient>
          <pattern id="belt-ribs" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="skewX(-26)">
            <rect width="32" height="32" fill="#101310" />
            <rect width="10" height="32" fill="#222723" />
            <path d="M13 0v32" stroke="#353C36" />
          </pattern>
          <pattern id="mesh" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M0 0 24 24M24 0 0 24" stroke="#747D75" strokeOpacity=".16" />
          </pattern>
        </defs>

        <g opacity=".38">
          <path d="M146 105h1200M92 183h1374M176 924h1200" stroke="#AAB1AB" strokeOpacity=".2" />
          <path d="M250 20v940M486 0v980M1280 50v920" stroke="#AAB1AB" strokeOpacity=".12" />
        </g>

        <g transform="translate(90 110)">
          <path d="M198 148h1034l116 74-101 99H169L72 242Z" fill="url(#steel-edge)" stroke="#778079" strokeWidth="3" />
          <path d="M177 169h1044l74 50-80 69H184L115 239Z" fill="url(#belt-ribs)" stroke="#9BA39C" strokeOpacity=".5" strokeWidth="2" />
          <path d="m184 288 1031 1 80-70v79l-67 70H198L115 298v-59Z" fill="#0A0C0A" stroke="#4D554E" strokeWidth="3" />

          <motion.g style={reduceMotion ? undefined : { x: upperProductsX }}>
            <Carton x={265} y={53} />
            <Bottle x={490} y={46} />
            <Pouch x={705} y={49} />
            <Carton x={950} y={58} width={92} height={110} />
          </motion.g>

          {rollers.map((cx, index) => (
            <Roller
              key={cx}
              cx={cx}
              cy={327}
              progress={scrollYProgress}
              reverse={index % 2 === 1}
              disabled={reduceMotion}
            />
          ))}

          <g transform="translate(900 -48)">
            <path d="M0 0h276v391h-64V68H64v323H0Z" fill="url(#steel)" stroke="#89928B" strokeWidth="3" />
            <path d="M65 80h146v102H65Z" fill="#090C09" stroke="#59615B" strokeWidth="2" />
            <path d="M81 101h114M81 126h82M81 151h98" stroke="#78817A" strokeWidth="7" />
            <rect x="82" y="200" width="112" height="30" fill="#C8FF3D" />
            <text x="138" y="220" fill="#111411" fontFamily="var(--font-marketing-mono)" fontSize="12" fontWeight="500" textAnchor="middle">
              SCAN ACTIVE
            </text>
            <motion.rect
              x="80"
              y="251"
              width="118"
              height="4"
              fill="#C8FF3D"
              style={
                reduceMotion
                  ? { y: 34, opacity: 0.7 }
                  : { y: scannerY, opacity: scannerOpacity }
              }
            />
            <Fastener x={31} y={31} />
            <Fastener x={245} y={31} />
          </g>

          <g transform="translate(152 366)">
            <path d="M0 0h1110v50H0Z" fill="url(#steel)" stroke="#5E675F" strokeWidth="2" />
            {[40, 270, 500, 730, 960].map((xPos) => (
              <g key={xPos}>
                <path d={`M${xPos} 50h46l-18 314h-58Z`} fill="url(#steel-edge)" stroke="#4E564F" strokeWidth="2" />
                <path d={`M${xPos - 6} 315h68v35h-68Z`} fill="#0B0D0C" stroke="#697169" strokeWidth="2" />
              </g>
            ))}
            <path d="M36 188h930" stroke="#58615A" strokeWidth="20" />
            <path d="M36 188h930" stroke="#A1A9A2" strokeOpacity=".28" strokeWidth="3" />
          </g>

          <g transform="translate(82 510)">
            <path d="M248 30h728l82 64-70 83H218l-80-71Z" fill="#101310" stroke="#69726A" strokeWidth="3" />
            <path d="M241 52h718l51 40-50 55H231l-48-43Z" fill="url(#belt-ribs)" />
            <path d="M218 177h770l70-83v75l-62 77H227l-89-78v-62Z" fill="#080A08" stroke="#474E48" strokeWidth="3" />
            {lowerRollers.map((cx, index) => (
              <Roller
                key={cx}
                cx={cx}
                cy={208}
                progress={scrollYProgress}
                reverse={index % 2 === 0}
                disabled={reduceMotion}
              />
            ))}
            <motion.g style={reduceMotion ? undefined : { x: lowerCratesX }}>
              <Crate x={360} y={-98} />
              <Crate x={704} y={-98} />
            </motion.g>
          </g>

          <g transform="translate(82 552)">
            <path d="M0 0h152v238H0Z" fill="#161A17" stroke="#667068" strokeWidth="3" />
            <path d="M20 24h112v65H20Z" fill="#080A08" stroke="#515951" />
            <path d="M36 43h80M36 60h52" stroke="#C8FF3D" strokeOpacity=".72" strokeWidth="5" />
            <circle cx="43" cy="126" r="13" fill="#C8FF3D" />
            <circle cx="82" cy="126" r="13" fill="#363D37" stroke="#747C75" />
            <circle cx="121" cy="126" r="13" fill="#363D37" stroke="#747C75" />
            <path d="M30 173h92M30 191h92" stroke="#566058" strokeWidth="8" />
            <Fastener x={14} y={14} />
            <Fastener x={138} y={14} />
            <Fastener x={14} y={224} />
            <Fastener x={138} y={224} />
          </g>

          <g transform="translate(1250 498)">
            <path d="M0 0h164v289H0Z" fill="url(#mesh)" stroke="#667068" strokeWidth="3" />
            <path d="M21 20h122v249H21Z" fill="none" stroke="#858E87" strokeOpacity=".35" strokeWidth="6" />
            <path d="M52 95h61v80H52Z" fill="#151915" stroke="#7D867F" strokeWidth="3" />
            <circle cx="82" cy="135" r="21" fill="#090B09" stroke="#C8FF3D" strokeOpacity=".66" strokeWidth="4" />
            <path d="M82 114v42M61 135h42" stroke="#929B94" strokeWidth="5" />
          </g>

          <path d="M1155 646h92l83-87" fill="none" stroke="#C8FF3D" strokeOpacity=".62" strokeWidth="3" strokeDasharray="7 10" />
          <path d="M120 500C42 460 20 390 68 318" fill="none" stroke="#525B53" strokeWidth="14" />
          <path d="M120 500C42 460 20 390 68 318" fill="none" stroke="#A4ACA5" strokeOpacity=".25" strokeWidth="3" />
        </g>
      </svg>
    </motion.div>
  );
}
