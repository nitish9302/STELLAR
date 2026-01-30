
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Trash2, Download, Eraser, Pencil, Square, Circle as CircleIcon, Image as ImageIcon, Grid, FileText, MousePointer2 } from "lucide-react";
import { io } from "socket.io-client";

const WhiteboardPage = () => {
    const { channelId } = useParams();
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const [socket, setSocket] = useState(null);

    // Tools: 'pencil', 'eraser', 'rect', 'circle', 'image', 'laser'
    const [tool, setTool] = useState("pencil");
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("#000000");
    const [lineWidth, setLineWidth] = useState(5);
    const [bgMode, setBgMode] = useState("blank");

    // Laser State
    const [localCursor, setLocalCursor] = useState(null); // { x, y } for local laser

    // Remote Cursors (Lasers) { [socketId]: { x, y, color } }
    const [remoteCursors, setRemoteCursors] = useState({});

    const prevPoint = useRef(null);
    const startPoint = useRef(null);
    const snapshotRef = useRef(null);
    const fileInputRef = useRef(null);

    // Socket Setup
    useEffect(() => {
        const backendUrl = "/";
        const newSocket = io(backendUrl, { transports: ['websocket', 'polling'] });

        setSocket(newSocket);

        newSocket.on("connect", () => {
            newSocket.emit("join-room", channelId);
        });

        newSocket.on("draw", (data) => {
            const ctx = canvasRef.current?.getContext("2d");
            if (!ctx) return;
            executeDrawCommand(ctx, data);
        });

        newSocket.on("cursor-move", (data) => {
            setRemoteCursors(prev => ({
                ...prev,
                [data.socketId]: { x: data.x, y: data.y, color: data.color }
            }));

            // Auto-remove cursor after 2s inactivity
            setTimeout(() => {
                setRemoteCursors(prev => {
                    const newState = { ...prev };
                    delete newState[data.socketId];
                    return newState;
                });
            }, 2000);
        });

        newSocket.on("clear-canvas", () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, [channelId]);

    // Canvas Resize
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 60;
        }
    }, [bgMode]);

    const executeDrawCommand = (ctx, data) => {
        ctx.lineWidth = data.width;
        ctx.strokeStyle = data.color;
        ctx.fillStyle = data.color;
        ctx.lineCap = "round";
        ctx.save();

        if (data.tool === 'pencil' || data.tool === 'eraser') {
            ctx.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over';
            if (data.tool === 'eraser') ctx.lineWidth = data.width * 2;

            ctx.beginPath();
            ctx.moveTo(data.start.x, data.start.y);
            ctx.lineTo(data.end.x, data.end.y);
            ctx.stroke();

        } else if (data.tool === 'rect') {
            ctx.beginPath();
            ctx.rect(data.start.x, data.start.y, data.end.x - data.start.x, data.end.y - data.start.y);
            ctx.stroke();

        } else if (data.tool === 'circle') {
            ctx.beginPath();
            const radius = Math.sqrt(Math.pow(data.end.x - data.start.x, 2) + Math.pow(data.end.y - data.start.y, 2));
            ctx.arc(data.start.x, data.start.y, radius, 0, 2 * Math.PI);
            ctx.stroke();

        } else if (data.tool === 'image') {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, ctx.canvas.width / img.width);
                ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
            };
            img.src = data.src;
        }

        ctx.restore();
    };

    const computePointInCanvas = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    const onMouseDown = (e) => {
        const point = computePointInCanvas(e);

        if (tool === 'laser') return;

        setIsDrawing(true);
        prevPoint.current = point;
        startPoint.current = point;

        if (tool === 'rect' || tool === 'circle') {
            const canvas = canvasRef.current;
            snapshotRef.current = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        }
    };

    const onMouseMove = (e) => {
        const currentPoint = computePointInCanvas(e);

        // Laser Logic
        if (tool === 'laser') {
            // Update local cursor for immediate feedback
            setLocalCursor(currentPoint);

            if (socket) {
                socket.emit("cursor-move", {
                    roomId: channelId,
                    socketId: socket.id,
                    x: currentPoint.x,
                    y: currentPoint.y,
                    color: color
                });
            }
            return;
        }

        if (!isDrawing) return;

        const ctx = canvasRef.current.getContext("2d");

        if (tool === 'pencil' || tool === 'eraser') {
            executeDrawCommand(ctx, {
                tool,
                start: prevPoint.current,
                end: currentPoint,
                color,
                width: lineWidth
            });

            if (socket) {
                socket.emit("draw", {
                    roomId: channelId,
                    tool,
                    start: prevPoint.current,
                    end: currentPoint,
                    color,
                    width: lineWidth
                });
            }
            prevPoint.current = currentPoint;
        } else if (tool === 'rect' || tool === 'circle') {
            if (snapshotRef.current) {
                ctx.putImageData(snapshotRef.current, 0, 0);
            }
            executeDrawCommand(ctx, {
                tool,
                start: startPoint.current,
                end: currentPoint,
                color,
                width: lineWidth
            });
        }
    };

    const onMouseUp = (e) => {
        if (!isDrawing) return;
        setIsDrawing(false);

        if (tool === 'rect' || tool === 'circle') {
            const currentPoint = computePointInCanvas(e);
            if (socket) {
                socket.emit("draw", {
                    roomId: channelId,
                    tool,
                    start: startPoint.current,
                    end: currentPoint,
                    color,
                    width: lineWidth
                });
            }
        }
        prevPoint.current = null;
        startPoint.current = null;
        snapshotRef.current = null;
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const src = event.target.result;
            const ctx = canvasRef.current.getContext("2d");
            const cmd = { tool: 'image', src, color, width: lineWidth };

            executeDrawCommand(ctx, cmd);
            if (socket) socket.emit("draw", { roomId: channelId, ...cmd });
        };
        reader.readAsDataURL(file);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (socket) socket.emit("clear-canvas", channelId);
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        const link = document.createElement("a");
        link.download = `whiteboard-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    };

    // Background Styles
    const getBgStyle = () => {
        if (bgMode === 'grid') return {
            backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '20px 20px'
        };
        if (bgMode === 'lined') return {
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 29px, #e5e7eb 30px)',
            backgroundSize: '100% 30px'
        };
        return { backgroundColor: 'white' };
    };

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
            {/* Header / Toolbar */}
            <div className="h-16 border-b flex items-center px-4 justify-between bg-base-100 z-50 shadow-sm relative">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[80vw]">
                    <button onClick={() => navigate(-1)} className="btn btn-ghost btn-circle btn-sm">
                        <ArrowLeft />
                    </button>

                    {/* Tool Group */}
                    <div className="flex gap-1 border-r pr-2 mr-2 items-center">
                        <button onClick={() => setTool('pencil')} className={`btn btn-sm btn-circle ${tool === 'pencil' ? 'btn-primary' : 'btn-ghost'}`} title="Pencil">
                            <Pencil size={18} />
                        </button>
                        <button onClick={() => setTool('eraser')} className={`btn btn-sm btn-circle ${tool === 'eraser' ? 'btn-primary' : 'btn-ghost'}`} title="Eraser">
                            <Eraser size={18} />
                        </button>
                        <button onClick={() => setTool('laser')} className={`btn btn-sm btn-circle ${tool === 'laser' ? 'btn-secondary shadow ring-2 ring-offset-1 ring-secondary/50' : 'btn-ghost'}`} title="Laser Pointer">
                            <MousePointer2 size={18} />
                        </button>
                        <button onClick={() => setTool('rect')} className={`btn btn-sm btn-circle ${tool === 'rect' ? 'btn-primary' : 'btn-ghost'}`} title="Rectangle">
                            <Square size={18} />
                        </button>
                        <button onClick={() => setTool('circle')} className={`btn btn-sm btn-circle ${tool === 'circle' ? 'btn-primary' : 'btn-ghost'}`} title="Circle">
                            <CircleIcon size={18} />
                        </button>
                        <button onClick={() => fileInputRef.current.click()} className="btn btn-sm btn-circle btn-ghost" title="Upload Image">
                            <ImageIcon size={18} />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    </div>

                    {/* Background Group */}
                    <div className="flex gap-1 border-r pr-2 mr-2">
                        <button onClick={() => setBgMode('blank')} className={`btn btn-xs ${bgMode === 'blank' ? 'btn-active' : ''}`}>Blank</button>
                        <button onClick={() => setBgMode('grid')} className={`btn btn-xs ${bgMode === 'grid' ? 'btn-active' : ''}`} title="Grid"><Grid size={12} /></button>
                        <button onClick={() => setBgMode('lined')} className={`btn btn-xs ${bgMode === 'lined' ? 'btn-active' : ''}`} title="Lined"><FileText size={12} /></button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                        title="Color Picker"
                    />
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={lineWidth}
                        onChange={(e) => setLineWidth(e.target.value)}
                        className="range range-xs w-20"
                        title="Brush/Text Size"
                    />

                    <button onClick={handleClear} className="btn btn-ghost btn-sm text-error" title="Clear All">
                        <Trash2 size={20} />
                    </button>

                    <button onClick={handleDownload} className="btn btn-ghost btn-sm" title="Save">
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative cursor-crosshair touch-none" style={getBgStyle()}
                onMouseLeave={() => setLocalCursor(null)} // Hide laser when leaving canvas
            >
                <canvas
                    ref={canvasRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    className="w-full h-full block z-0"
                />

                {/* Laser Pointers Overlay */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                    {localCursor && tool === 'laser' && (
                        <div
                            style={{
                                position: 'absolute',
                                left: localCursor.x,
                                top: localCursor.y,
                                width: '12px',
                                height: '12px',
                                backgroundColor: color,
                                borderRadius: '50%',
                                boxShadow: `0 0 10px 4px ${color}`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 100
                            }}
                        />
                    )}
                    {Object.entries(remoteCursors).map(([id, cursor]) => (
                        <div
                            key={id}
                            style={{
                                position: 'absolute',
                                left: cursor.x,
                                top: cursor.y,
                                width: '12px',
                                height: '12px',
                                backgroundColor: cursor.color || 'red',
                                borderRadius: '50%',
                                boxShadow: `0 0 10px 4px ${cursor.color || 'red'}`,
                                transform: 'translate(-50%, -50%)',
                                transition: 'all 0.1s linear',
                                zIndex: 99
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WhiteboardPage;
