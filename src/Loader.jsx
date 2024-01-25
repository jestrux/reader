const Loader = ({
	className,
	color = "currentColor",
	thickness = 7,
	size = 30,
	fillParent = false,
	scrimColor = "rgba(255, 255, 255, 0.7)",
}) => {
	const loader = (
		<svg
			className={className}
			width={size}
			height={`${size}px`}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 100 100"
			preserveAspectRatio="xMidYMid"
			style={{ background: "none" }}
		>
			<circle
				cx="50"
				cy="50"
				fill="none"
				stroke={color}
				strokeWidth={thickness}
				r="35"
				strokeDasharray="164.93361431346415 56.97787143782138"
				transform="rotate(269.874 50 50)"
			>
				<animateTransform
					attributeName="transform"
					type="rotate"
					calcMode="linear"
					values="0 50 50;360 50 50"
					keyTimes="0;1"
					dur="1s"
					begin="0s"
					repeatCount="indefinite"
				></animateTransform>
			</circle>
		</svg>
	);

	if (fillParent) {
		return (
			<span
				className="absolute inset-0 flex items-center justify-center"
				style={{ background: scrimColor }}
			>
				{loader}
			</span>
		);
	}

	return loader;
};

export default Loader;
