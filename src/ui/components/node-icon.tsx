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
import RectangleIcon from './icons/node-types/recatangle';
import SectionIcon from './icons/node-types/section';
import SliceIcon from './icons/node-types/slice';
import MediaNodeIcon from './icons/node-types/media-node';

type NodeIconProps = {
	type: SceneNode['type'];
} & React.HTMLAttributes<SVGElement>;

const NodeIcon = ({ type, ...props }: NodeIconProps) => {
	switch (type) {
		case 'BOOLEAN_OPERATION':
			return <BooleanOperationIcon {...props} />;
		case 'COMPONENT':
			return <ComponentIcon {...props} />;
		case 'COMPONENT_SET':
			return <ComponentSetIcon {...props} />;
		case 'INSTANCE':
			return <InstanceIcon {...props} />;
		case 'GROUP':
			return <GroupNodeIcon {...props} />;
		case 'FRAME':
			return <FrameIcon {...props} />;
		case 'VECTOR':
			return <VectorIcon {...props} />;
		case 'RECTANGLE':
			return <RectangleIcon {...props} />;
		case 'LINE':
			return <LineIcon {...props} />;
		case 'ELLIPSE':
			return <EllipseIcon {...props} />;
		case 'POLYGON':
			return <PolygonIcon {...props} />;
		case 'STAR':
			return <StarIcon {...props} />;
		case 'TRANSFORM_GROUP':
			return <TransformGroupIcon {...props} />;
		case 'TEXT':
			return <TextIcon {...props} />;
		case 'TEXT_PATH':
			return <TextIcon {...props} />;
		case 'SHAPE_WITH_TEXT':
			return <TextIcon {...props} />;
		case 'SECTION':
			return <SectionIcon {...props} />;
		case 'SLICE':
			return <SliceIcon {...props} />;
		case 'MEDIA':
			return <MediaNodeIcon {...props} />;
		default:
			return <DefaultIcon {...props} />;
	}
};

export default NodeIcon;
