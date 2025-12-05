import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from './ui/empty';
import { Search } from 'lucide-react';

const WelcomePane = ({ ...props }: React.ComponentProps<typeof Empty>) => {
	return (
		<Empty {...props}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Search size="24" />
				</EmptyMedia>
				{/* <EmptyTitle>No data</EmptyTitle> */}
				<EmptyDescription>
					Start by searching for a variable to see where it's used throughout your design.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
};

export default WelcomePane;
