import ComponentIcon from './icons/node-types/component';
import BooleanOperationIcon from './icons/node-types/boolean-operation';
import DefaultIcon from './icons/node-types/default';
import ComponentSetIcon from './icons/node-types/component-set';
import InstanceIcon from './icons/node-types/instance';
import GroupNodeIcon from './icons/node-types/group-node';
import FrameIcon from './icons/node-types/frame';
import VectorIcon from './icons/node-types/vector';
import LineIcon from './icons/node-types/line';
import EllipseIcon from './icons/node-types/ellipse';
import PolygonIcon from './icons/node-types/polygon';
import StarIcon from './icons/node-types/star';
import TransformGroupIcon from './icons/node-types/transform-group';
import TextIcon from './icons/node-types/text';
import RectangleIcon from './icons/node-types/rectangle';
import SectionIcon from './icons/node-types/section';
import SliceIcon from './icons/node-types/slice';
import MediaNodeIcon from './icons/node-types/media-node';
import type { NodeType } from '../../shared/rpc-types';

type NodeIconProps = {
	type: NodeType;
} & React.HTMLAttributes<SVGElement>;

const NODE_ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
	BOOLEAN_OPERATION: BooleanOperationIcon,
	COMPONENT: ComponentIcon,
	COMPONENT_SET: ComponentSetIcon,
	INSTANCE: InstanceIcon,
	GROUP: GroupNodeIcon,
	FRAME: FrameIcon,
	VECTOR: VectorIcon,
	RECTANGLE: RectangleIcon,
	LINE: LineIcon,
	ELLIPSE: EllipseIcon,
	POLYGON: PolygonIcon,
	STAR: StarIcon,
	TRANSFORM_GROUP: TransformGroupIcon,
	TEXT: TextIcon,
	TEXT_PATH: TextIcon,
	SHAPE_WITH_TEXT: TextIcon,
	SECTION: SectionIcon,
	SLICE: SliceIcon,
	MEDIA: MediaNodeIcon,
};

const NodeIcon = ({ type, ...props }: NodeIconProps) => {
	const Icon = NODE_ICON_MAP[type] ?? DefaultIcon;
	return <Icon aria-hidden="true" {...props} />;
};

export default NodeIcon;
